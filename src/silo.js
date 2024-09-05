const fs = require('fs');
const { BEANSTALK, BEAN, UNRIPE_BEAN, UNRIPE_LP, BEANWETH } = require('./contracts/addresses.js');
const { providerThenable, localProvider } = require('./contracts/provider');
const { tokenEq } = require('./utils/token.js');
const { bigintHex, bigintDecimal } = require('./utils/json-formatter.js');
const { asyncBeanstalkContractGetter } = require('./contracts/contract.js');
const retryable = require('./utils/retryable.js');
const storageLayout = require('./contracts/abi/storageLayout.json');
const ContractStorage = require('@beanstalk/contract-storage');
const { getBeanEthUnripeLP, getBean3CrvUnripeLP, getBeanLusdUnripeLP, seasonToStem, getLegacySeedsPerToken, packAddressAndStem, WHITELISTED_LP } = require('./utils/silo/silo-util.js');
const { getL2TokenAmount } = require('./utils/balances/balances-util.js');
const { getDuneResult } = require('./contracts/dune');

let LOCAL = false;
let BLOCK;
let beanstalk;
let bs;

// Exploit migration
const INITIAL_RECAP = BigInt(185564685220298701);

let stemStartSeason; // For v2 -> v3
let stemScaleSeason; // For v3 -> v3.1
let accountUpdates = {};
let parseProgress = 0;
let walletProgress = 0;
let stemTips = {};

let netSystemStalk = BigInt(0);
let netSystemMownStalk = BigInt(0);
let sumUserEarnedBeans = BigInt(0);

const BATCH_SIZE = 100;

async function preProcessInit(deposits, rows) {
  for (const row of rows) {
    const [account, token] = [row.account, row.token];

    if (!deposits[account]) {
      deposits[account] = {};
    }
    if (!deposits[account][token]) {
      deposits[account][token] = {};
    }
  }
}

// Silo v3 migrated stems
async function processRow(deposits, row) {
  let [account, token, stem, season, amount, bdv] = [row.account, row.token, row.stem ?? '', row.season ?? '', row.amount_balance, row.bdv_balance];

  let version = '';

  if (!stemTips[token]) {
    try {
      stemTips[token] = await retryable(async () =>
        BigInt(await beanstalk.callStatic.stemTipForToken(token, { blockTag: BLOCK }))
      );
    } catch (e) {
      // stemTipForToken did not exist
      stemTips[token] = seasonToStem(Number(await bs.s.season.current), stemStartSeason, getLegacySeedsPerToken(token))
    }
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
    stem = seasonToStem(season, stemStartSeason, getLegacySeedsPerToken(token));
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
        const { amount: ethAmount, bdv: ethBdv } = await getBeanEthUnripeLP(account, season, bs);
        const { amount: crvAmount, bdv: crvBdv } = await getBean3CrvUnripeLP(account, season, bs);
        const { amount: lusdAmount, bdv: lusdBdv } = await getBeanLusdUnripeLP(account, season, bs);
        
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
// Also performs async lp scaling according to supply on L2.
async function calcDepositTotals(account, deposits) {
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
    let totalL2Deposited = 0n;
    for (const stem in deposits[account][token]) {
      deposits[account].totals[token].amount += deposits[account][token][stem].amount;
      deposits[account].totals[token].bdv += deposits[account][token][stem].bdv;
      if (deposits[account][token][stem].version.includes('season')) {
        deposits[account].totals[token].seeds += deposits[account][token][stem].bdv * getLegacySeedsPerToken(token);
      }
      // Scale l2 token amounts for each deposit
      const l2TokenAmount = await getL2TokenAmount(token, deposits[account][token][stem].amount, BLOCK);
      deposits[account][token][stem].l2Amount = l2TokenAmount;
      totalL2Deposited += l2TokenAmount;
    }
    // Scale lp token amounts according to the amount minted on l2
    deposits[account].totals[token].l2Amount = totalL2Deposited;
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
      result[k] = (Number(v / BigInt(10 ** 14)) / Math.pow(10, 2)).toLocaleString();
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
    if (!deposits[depositor][BEAN][stemTips[BEAN]]) {
      deposits[depositor][BEAN][stemTips[BEAN]] = {
        amount: earnedBeans,
        bdv: earnedBeans,
        version: ['v3.1'],
        // Need to set stalk here since they necessarily have not mown on the current season
        // 16 decimals for L2
        stalk: earnedBeans * BigInt(10 ** 10),
        stalkIfMown: earnedBeans * BigInt(10 ** 10)
      };
    } else {
      deposits[depositor][BEAN][stemTips[BEAN]].amount += earnedBeans;
      deposits[depositor][BEAN][stemTips[BEAN]].bdv += earnedBeans;
      deposits[depositor][BEAN][stemTips[BEAN]].version.push('v3.1');
      // Don't need to set stalk here since they must have already mown this season
    }
    sumUserEarnedBeans += earnedBeans;
  }
  await calcDepositTotals(depositor, deposits);

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
          mowStem = seasonToStem(accountUpdates[depositor], stemStartSeason, getLegacySeedsPerToken(token));
        }
        // Current delta, max delta (if mown now)
        const stemDeltas = [mowStem - BigInt(stem), stemTips[token] - BigInt(stem)];
        // Deposit stalk = grown + base stalk
        // stems have 6 precision, though 10 is needed to grow one stalk. 10 + 6 => 16 precision for stalk
        const stalk = stemDeltas.map(delta => (delta + 10000000000n) * deposits[depositor][token][stem].bdv);
        deposits[depositor][token][stem].stalk = stalk[0];
        deposits[depositor][token][stem].stalkIfMown = stalk[1];
      }
      netTokenStalk += deposits[depositor][token][stem].stalk;
      netTokenMownStalk += deposits[depositor][token][stem].stalkIfMown;
    }
    netDepositorStalk += netTokenStalk;
    netDepositorMownStalk += netTokenMownStalk;
    results[depositor].breakdown[token] = netTokenStalk;
    deposits[depositor].totals[token].mowStem = mowStem;
  }

  const contractStalk = await getContractStalk(depositor);
  results[depositor].depositStalk = netDepositorStalk;
  results[depositor].contractStalk = contractStalk.sum;
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
  deposits[depositor].totals.stalkMinusGerminating = netDepositorStalk - contractStalk.germinating;
  deposits[depositor].totals.stalkInclGerminating = netDepositorStalk;
  deposits[depositor].totals.stalkIfMownMinusGerminating = netDepositorMownStalk - contractStalk.germinating;
  deposits[depositor].totals.stalkIfMownInclGerminating = netDepositorMownStalk;

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
  // Scaled +6 decimals for L2
  return {
    storage: storage * BigInt(10 ** 6),
    earned: earned * BigInt(10 ** 6),
    germinating: germinating * BigInt(10 ** 6),
    doneGerminating: doneGerminating * BigInt(10 ** 6),
    sum: (storage + earned + germinating + doneGerminating) * BigInt(10 ** 6)
  }
}

async function getSystemGerminating() {
  const both = await Promise.all(['oddGerminating', 'evenGerminating'].map(async field => {
    const germinating = await Promise.all([BEAN, BEANWETH, UNRIPE_BEAN, UNRIPE_LP].map(token =>
      bs.s[field].deposited[token].bdv
    ));
    return germinating.reduce((a, next) => a + next * BigInt(10 ** 10), 0n); // bdv is 6, +10 to get to 16
  }));
  return both.reduce((a, next) => a + next, 0n);
}

async function exportDeposits(block) {

  BLOCK = block;

  if (!LOCAL) {
    beanstalk = await asyncBeanstalkContractGetter();
    bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);
  } else {
    beanstalk = await asyncBeanstalkContractGetter({ isLocal: true });
    bs = new ContractStorage(localProvider, BEANSTALK, storageLayout, BLOCK);
  }
  stemStartSeason = await bs.s.season.stemStartSeason;
  stemScaleSeason = await bs.s.season.stemScaleSeason;

  console.log('Pulling deposits data from dune...');
  const duneResult = await getDuneResult(3849370, BLOCK);

  const deposits = {};
  console.log('Reading deposits data...');

  let rowsBuffer = [];
  for await (const row of duneResult.result.rows) {
    rowsBuffer.push(row);
    if (rowsBuffer.length >= BATCH_SIZE) {
      await preProcessInit(deposits, rowsBuffer);
      await Promise.all(rowsBuffer.map(row => processRow(deposits, row)));
      rowsBuffer = [];
    }
  }
  if (rowsBuffer.length > 0) {
    await preProcessInit(deposits, rowsBuffer);
    await Promise.all(rowsBuffer.map(row => processRow(deposits, row)));
  }

  console.log(`\rFinished processing ${parseProgress} entries`);

  // Check all wallets and output to file
  console.log(`Checking ${Object.keys(deposits).length} wallets...`);
  const results = await checkWallets(deposits);

  // Add global totals to deposits object before writing to out file
  const depositsOutput = {
    accounts: deposits,
    totals: Object.keys(deposits).reduce((a, next) => {
      a.stalkMinusGerminating += deposits[next].totals.stalkMinusGerminating;
      a.stalkInclGerminating += deposits[next].totals.stalkInclGerminating;
      a.stalkIfMownMinusGerminating += deposits[next].totals.stalkIfMownMinusGerminating;
      a.stalkIfMownInclGerminating += deposits[next].totals.stalkIfMownInclGerminating;
      return a;
    }, {
      stalkMinusGerminating: 0n,
      stalkInclGerminating: 0n,
      stalkIfMownMinusGerminating: 0n,
      stalkIfMownInclGerminating: 0n,
      stemTips
    })
  };

  const outFile = `results/deposits${BLOCK}.json`;
  await fs.promises.writeFile(outFile, JSON.stringify(depositsOutput, bigintDecimal, 2));
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
  // Germinating is added here because it was added into all user balances already (but not s.s.stalk)
  const storageStalk = (await bs.s.s.stalk) * BigInt(10 ** 6) + storageGerminating;
  const storageEarnedBeans = await bs.s.earnedBeans;
  console.log(`Expected sum (s.s.stalk + s.odd/evenGerminating):         ${storageStalk}`);
  console.log(`Difference?                                               ${storageStalk - netSystemStalk}`)
  console.log(`System germinating:                                       ${storageGerminating}`);
  console.log(`System stalk after all is planted/mown:                   ${netSystemMownStalk}`);
  console.log(`System earned beans:                                      ${storageEarnedBeans}`);
  console.log(`Sum of planted user earned beans:                         ${sumUserEarnedBeans}`);
  console.log(`Difference?                                               ${storageEarnedBeans - sumUserEarnedBeans}`);
}

module.exports = {
  exportDeposits
};

// const ethers = require('ethers');
// (async () => {
//   const receipt = await localProvider.getTransactionReceipt("0xc1a59e011fef5e6d2e086118d1b65ce8c9daf6ee245c23637954428280737a62");
//   console.log(receipt.logs);
// })()
