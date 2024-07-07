const fs = require('fs');
const readline = require('readline');
const { BEANSTALK, BEAN, UNRIPE_BEAN, UNRIPE_LP, BEAN3CRV, BEANWETH } = require('./contracts/addresses.js');
const { providerThenable, localProvider } = require('./contracts/provider');
const { tokenEq } = require('./utils/token.js');
const { bigintHex, bigintDecimal } = require('./utils/json-formatter.js');
const { asyncBeanstalkContractGetter } = require('./contracts/contract.js');
const retryable = require('./utils/retryable.js');
const storageLayout = require('./contracts/abi/storageLayout.json');
const ContractStorage = require('@beanstalk/contract-storage');

let LOCAL = false;
let BLOCK;
let beanstalk;
let bs;

// Exploit migration
const INITIAL_RECAP = BigInt(185564685220298701);
const AMOUNT_TO_BDV_BEAN_ETH = BigInt(119894802186829);
const AMOUNT_TO_BDV_BEAN_3CRV = BigInt(992035);
const AMOUNT_TO_BDV_BEAN_LUSD = BigInt(983108);
const UNRIPE_CURVE_BEAN_METAPOOL = '0x3a70DfA7d2262988064A2D051dd47521E43c9BdD';
const UNRIPE_CURVE_BEAN_LUSD_POOL = '0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D';

let stemStartSeason; // For v2 -> v3
let stemScaleSeason; // For v3 -> v3.1
let accountUpdates = {};
let parseProgress = 0;
let walletProgress = 0;
let stemTips = {};

let netSystemStalk = BigInt(0);
let netSystemMownStalk = BigInt(0);

const BATCH_SIZE = 100;

// Equivalent to LibBytes.packAddressAndStem
function packAddressAndStem(address, stem) {
  const addressBigInt = BigInt(address);
  const stemBigInt = BigInt(stem);
  return (addressBigInt << BigInt(96)) | (stemBigInt & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFF'));
}

// Equivalent to LibLegacyTokenSilo.seasonToStem
function seasonToStem(season, seedsPerBdv) {
  return (BigInt(season) - stemStartSeason) * (seedsPerBdv * BigInt(10 ** 6));
}

// Equivalent to LibLegacyTokenSilo.getLegacySeedsPerToken
function getLegacySeedsPerToken(token) {
  if (tokenEq(token, BEAN)) {
    return 2n;
  } else if (tokenEq(token, UNRIPE_BEAN)) {
    return 2n;
  } else if (tokenEq(token, UNRIPE_LP)) {
    return 4n;
  } else if (tokenEq(token, BEAN3CRV)) {
    return 4n;
  }
  return 0n;
}

async function getBeanEthUnripeLP(account, season) {
  return {
    amount: (await bs.s.a[account].lp.deposits[season]) * AMOUNT_TO_BDV_BEAN_ETH / BigInt(10 ** 18),
    bdv: (await bs.s.a[account].lp.depositSeeds[season]) / BigInt(4)
  }
}

async function getBean3CrvUnripeLP(account, season) {
  return {
    amount: (await bs.s.a[account].legacyV2Deposits[UNRIPE_CURVE_BEAN_METAPOOL][season].amount) * AMOUNT_TO_BDV_BEAN_3CRV / BigInt(10 ** 18),
    bdv: await bs.s.a[account].legacyV2Deposits[UNRIPE_CURVE_BEAN_METAPOOL][season].bdv
  }
}

async function getBeanLusdUnripeLP(account, season) {
  return {
    amount: (await bs.s.a[account].legacyV2Deposits[UNRIPE_CURVE_BEAN_LUSD_POOL][season].amount) * AMOUNT_TO_BDV_BEAN_LUSD / BigInt(10 ** 18),
    bdv: await bs.s.a[account].legacyV2Deposits[UNRIPE_CURVE_BEAN_LUSD_POOL][season].bdv
  }
}

async function preProcessInit(deposits, lines) {
  for (const line of lines) {
    const [account, token] = line.split(',');

    if (!deposits[account]) {
      deposits[account] = {};
    }
    if (!deposits[account][token]) {
      deposits[account][token] = {};
    }
  }
}

// Silo v3 migrated stems
async function processLine(deposits, line) {
  let [account, token, stem, season, amount, bdv] = line.split(',');

  let version = '';

  if (!stemTips[token]) {
    stemTips[token] = await retryable(async () =>
      BigInt(await beanstalk.callStatic.stemTipForToken(token, { blockTag: BLOCK }))
    );
  }

  if (stem !== '') {

    // Silo v3 migrated stems. Transform to v3.1 if needed
    const { actualStem, isMigrated3_1 } = await transformStem(account, token, BigInt(stem));
    stem = actualStem;
    version = isMigrated3_1 ? 'v3.1' : 'v3';

  } else {
    // Deposits by season. The RemoveDeposit(s) events are missing bdv from
    // the event data, so the information must be retrieved from storage directly. The provided entries are
    // all tokens/season numbers for each user. Pre-replant events are not included.
    // In theory there shouldnt be any users here who also have a v3 deposit.
    stem = seasonToStem(season, getLegacySeedsPerToken(token));
    amount = await bs.s.a[account].legacyV2Deposits[token][season].amount;
    bdv = await bs.s.a[account].legacyV2Deposits[token][season].bdv;
    if (season < 6075) {
      if (tokenEq(token, UNRIPE_BEAN)) {
        // LibUnripeSilo.unripeBeanDeposit
        const legacyAmount = await bs.s.a[account].bean.deposits[season];
        amount = amount + legacyAmount;
        bdv = bdv + legacyAmount * INITIAL_RECAP / BigInt(10 ** 18)
      } else if (tokenEq(token, UNRIPE_LP)) {
        // LibUnripeSilo.unripeLPDeposit
        const { amount: ethAmount, bdv: ethBdv } = await getBeanEthUnripeLP(account, season);
        const { amount: crvAmount, bdv: crvBdv } = await getBean3CrvUnripeLP(account, season);
        const { amount: lusdAmount, bdv: lusdBdv } = await getBeanLusdUnripeLP(account, season);
        
        amount = amount + ethAmount + crvAmount + lusdAmount;
        const legBdv = (ethBdv + crvBdv + lusdBdv) * INITIAL_RECAP / BigInt(10 ** 18);
        bdv = bdv + legBdv;
      }
    }
    version = 'season';
  }
  if (!deposits[account][token][stem]) {
    deposits[account][token][stem] = {
      amount: BigInt(0),
      bdv: BigInt(0),
      version: []
    };
  }

  deposits[account][token][stem].amount += BigInt(amount);
  deposits[account][token][stem].bdv += BigInt(bdv);
  deposits[account][token][stem].version.push(version);

  process.stdout.write(`\r${++parseProgress} / ?`);
}

// Now that all deposits are populated, calculate total deposited amount/bdv for each token per user
function calcDepositTotals(account, deposits) {
  deposits[account].totals = {};
  for (const token in deposits[account]) {
    if (token == 'totals') {
      continue;
    }
    deposits[account].totals[token] = {
      amount: 0n,
      bdv: 0n,
      seeds: 0n
    };
    for (const stem in deposits[account][token]) {
      deposits[account].totals[token].amount += deposits[account][token][stem].amount;
      deposits[account].totals[token].bdv += deposits[account][token][stem].bdv;
      if (deposits[account][token][stem].version.includes('season')) {
        deposits[account].totals[token].seeds += deposits[account][token][stem].bdv * getLegacySeedsPerToken(token);
      }
    }
  }
}

// Transforms the stem according to silo v3.1
function scaleStem(stem) {
  return stem * BigInt(10 ** 6);
}

// Transforms the stem according to silo v3.1 if appropriate. Checks for legacy deposit
async function transformStem(account, token, stem) {
  const depositId = packAddressAndStem(token, stem);
  if (await bs.s.a[account].legacyV3Deposits[depositId].amount > 0n) {
    return {
      actualStem: scaleStem(stem),
      isMigrated3_1: false
    }
  }
  return {
    actualStem: stem,
    isMigrated3_1: true
  }
}

async function checkWallets(deposits) {
  const results = {};
  const depositors = Object.keys(deposits);

  for (let i = 0; i < depositors.length; i += BATCH_SIZE) {
    const batch = depositors.slice(i, Math.min(i + BATCH_SIZE, depositors.length));
    await Promise.all(batch.map(depositor => checkWallet(results, deposits, depositor)));
  }

  // Format the result with raw hex values and decimal values
  const reducer = (result, [k, v]) => {
    if (typeof v === 'bigint') {
      result[k] = (Number(v / BigInt(10 ** 8)) / Math.pow(10, 2)).toLocaleString();
    } else {
      result[k] = Object.entries(v).reduce(reducer, {});
    }
    return result;
  };

  return Object.entries(results).reduce((result, [k, v]) => {
    result[k] =  {
      raw: v,
      formatted: Object.entries(v).reduce(reducer, {})
    };
    return result;
  }, {});
}

// Deposits is mutated to add the computed value for expected stalk, mowable stalk, germination info,
// and plants any earned beans
async function checkWallet(results, deposits, depositor) {

  accountUpdates[depositor] = await bs.s.a[depositor].lastUpdate;
  results[depositor] = { breakdown: {} };

  // Plant at the current stem if there are any earned beans
  const earnedBeans = BigInt(await retryable(async () => 
    beanstalk.callStatic.balanceOfEarnedBeans(depositor, { blockTag: BLOCK })
  ));
  if (earnedBeans !== BigInt(0)) {
    if (!deposits[depositor][BEAN]) {
      deposits[depositor][BEAN] = {};
    }
    deposits[depositor][BEAN][stemTips[BEAN]] = {
      amount: earnedBeans,
      bdv: earnedBeans,
      version: ['v3.1'],
      stalk: earnedBeans * BigInt(10 ** 4),
      stalkIfMown: earnedBeans * BigInt(10 ** 4)
    };
  }
  calcDepositTotals(depositor, deposits);

  let netDepositorStalk = 0n;
  let netDepositorMownStalk = 0n;
  for (const token in deposits[depositor]) {
    if (token == 'totals') {
      continue;
    }

    let mowStem = await bs.s.a[depositor].mowStatuses[token].lastStem;
    if (
      // If stemScaleSeason is unset, then that upgrade hasnt happened yet and thus the user hasnt migrated
      stemScaleSeason == 0
      || (accountUpdates[depositor] < stemScaleSeason && accountUpdates[depositor] > 0)
      // Edge case for when user update and stem scale occurred at the same season
      || (accountUpdates[depositor] == stemScaleSeason && mowStem > 0 && stemTips[token] / mowStem >= BigInt(10 ** 6))
    ) {
      mowStem = scaleStem(mowStem);
    }

    let netTokenStalk = 0n;
    let netTokenMownStalk = 0n;
    for (const stem in deposits[depositor][token]) {
      // earned beans were already calculated above
      if (!deposits[depositor][token][stem].stalk) {
        if (deposits[depositor][token][stem].version.includes('season')) {
          mowStem = seasonToStem(accountUpdates[depositor], getLegacySeedsPerToken(token));
        }
        // Current delta, max delta (if mown now)
        const stemDeltas = [mowStem - BigInt(stem), stemTips[token] - BigInt(stem)];
        // Deposit stalk = grown + base stalk
        // stems have 6 precision, though 10 is needed to grow one stalk. 10 + 6 - 6 => 10 precision for stalk
        const stalk = stemDeltas.map(delta => (delta + 10000000000n) * deposits[depositor][token][stem].bdv / BigInt(10 ** 6));
        deposits[depositor][token][stem].stalk = stalk[0];
        deposits[depositor][token][stem].stalkIfMown = stalk[1];
      }
      netTokenStalk += deposits[depositor][token][stem].stalk;
      netTokenMownStalk += deposits[depositor][token][stem].stalkIfMown;
    }
    netDepositorStalk += netTokenStalk;
    netDepositorMownStalk += netTokenMownStalk;
    results[depositor].breakdown[token] = netTokenStalk;
  }

  results[depositor].depositStalk = netDepositorStalk;
  results[depositor].contractStalk = await getContractStalk(depositor);
  results[depositor].discrepancy = results[depositor].depositStalk - results[depositor].contractStalk;

  if (Object.values(deposits[depositor].totals).some(v => v.seeds > 0n)) {
    results[depositor].depositSeeds = Object.values(deposits[depositor].totals).reduce(
      (ans, next) => ans + next.seeds,
      0n
    );
    results[depositor].contractSeeds = await bs.s.a[depositor].s.seeds;
    results[depositor].seedsDiscrepancy = results[depositor].depositSeeds - results[depositor].contractSeeds;
  }

  // Write total stalk/germinating to the deposits object so it can be available in a single file
  const [oddGerm, evenGerm] = await Promise.all([
    bs.s.a[depositor].farmerGerminating.odd,
    bs.s.a[depositor].farmerGerminating.even
  ]);
  deposits[depositor].totals.stalkInclGerminating = netDepositorStalk;
  deposits[depositor].totals.germinating = {
    odd: oddGerm,
    even: evenGerm
  };

  netSystemStalk += netDepositorStalk;
  netSystemMownStalk += netDepositorMownStalk;

  process.stdout.write(`\r${++walletProgress} / ${Object.keys(deposits).length}`);
}

// Since we need to match the stalk + grown stalk by bdv against the contract values, need to include
// anything that has finished germinating or is still germinating (and this not part of s.a[depositor].s.stalk)
// NOT including earned beans since we are only trying to verify deposits.
async function getContractStalk(account) {
  const [storage, earned, germinating, doneGerminating] = await Promise.all([
    bs.s.a[account].s.stalk,
    retryable(async () => 
      BigInt(await beanstalk.callStatic.balanceOfEarnedStalk(account, { blockTag: BLOCK }))
    ),
    retryable(async () => {
      try {
        return BigInt(await beanstalk.callStatic.balanceOfGerminatingStalk(account, { blockTag: BLOCK }));
      } catch (e) {
        // Germination may not be implemented yet
        return 0n;
      }
    }),
    retryable(async () => {
      try {
        return BigInt((await beanstalk.callStatic.balanceOfFinishedGerminatingStalkAndRoots(account, { blockTag: BLOCK }))[0]);
      } catch (e) {
        // Germination may not be implemented yet
        return 0n;
      }
    })
  ]);
  return storage + earned + germinating + doneGerminating;
}

async function getSystemGerminating() {
  const both = await Promise.all(['oddGerminating', 'evenGerminating'].map(async field => {
    const germinating = await Promise.all([BEAN, BEANWETH, UNRIPE_BEAN, UNRIPE_LP].map(token =>
      bs.s[field].deposited[token].bdv
    ));
    return germinating.reduce((a, next) => a + next * BigInt(10 ** 4), 0n);
  }));
  return both.reduce((a, next) => a + next, 0n);
}

async function exportDeposits(block) {

  BLOCK = block;

  if (!LOCAL) {
    beanstalk = await asyncBeanstalkContractGetter();
    bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);
  } else {
    beanstalk = await asyncBeanstalkContractGetter(true);
    bs = new ContractStorage(localProvider, BEANSTALK, storageLayout, BLOCK);
  }
  stemStartSeason = await bs.s.season.stemStartSeason;
  stemScaleSeason = await bs.s.season.stemScaleSeason;

  // https://dune.com/queries/3819175
  const fileStream = fs.createReadStream(`inputs/silo${BLOCK}.csv`);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const deposits = {};
  console.log('Reading deposits data from file...');

  let linesBuffer = [];
  for await (const line of rl) {
    if (!line.includes('account')) {
      linesBuffer.push(line);
    }
    if (linesBuffer.length >= BATCH_SIZE) {
      await preProcessInit(deposits, linesBuffer);
      await Promise.all(linesBuffer.map(line => processLine(deposits, line)));
      linesBuffer = [];
    }
  }
  if (linesBuffer.length > 0) {
    await preProcessInit(deposits, linesBuffer);
    await Promise.all(linesBuffer.map(line => processLine(deposits, line)));
  }

  console.log(`\rFinished processing ${parseProgress} entries`);

  // Check all wallets and output to file
  console.log(`Checking ${Object.keys(deposits).length} wallets...`);
  const results = await checkWallets(deposits);

  const outFile = `results/deposits${BLOCK}.json`;
  await fs.promises.writeFile(outFile, JSON.stringify(deposits, bigintDecimal, 2));
  console.log(`\rWrote results to ${outFile}`);

  const discrepancyFile = `results/deposit-discrepancies${BLOCK}.json`;
  const formatted = Object.entries(results).filter(([k, v]) =>
    results[k].raw.discrepancy !== 0n
  ).sort(([_, a], [_1, b]) =>
    Math.abs(parseFloat(b.formatted.discrepancy.replace(/,/g, ''))) - Math.abs(parseFloat(a.formatted.discrepancy.replace(/,/g, '')))
  );
  await fs.promises.writeFile(discrepancyFile, JSON.stringify(formatted, bigintHex, 2));
  console.log(`Wrote discrepancy summary to ${discrepancyFile}`);

  console.log('--------------------------------------------------------------------------------------');
  console.log(`Sum of all user stalk (including earned and germinating): ${netSystemStalk}`);
  const storageGerminating = await getSystemGerminating();
  // Germinating is added here because it was added into all user balances already
  const storageStalk =  await bs.s.s.stalk + storageGerminating;
  console.log(`Expected sum (s.s.stalk + s.odd/evenGerminating):         ${storageStalk}`);
  console.log(`Difference?                                               ${storageStalk - netSystemStalk}`)
  console.log(`System germinating:                                       ${storageGerminating}`);
  console.log(`Sum after all is mown/planted:                            ${netSystemMownStalk}`);
}

module.exports = {
  exportDeposits
};

// const ethers = require('ethers');
// (async () => {
//   const receipt = await localProvider.getTransactionReceipt("0xc1a59e011fef5e6d2e086118d1b65ce8c9daf6ee245c23637954428280737a62");
//   console.log(receipt.logs);
// })()
