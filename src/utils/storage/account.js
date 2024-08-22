const fs = require('fs');
const { packAddressAndStem } = require('../silo/silo-util');
const { runBatchPromises } = require('../batch-promise');
const { l2Token } = require('../token');

let BLOCK;
let bs;
let currentSeason;

let allDeposits;
let allPlots;
let allAccounts;

let walletProgress = 0;

async function allAccountStructs(options) {

  console.log('Gathering accounts info...');

  BLOCK = options.block;
  bs = options.bs;

  currentSeason = await bs.s.season.current;

  // Load the balance result files (need to have already been computed)
  allDeposits = JSON.parse(fs.readFileSync(`results/deposits${BLOCK}.json`));
  allPlots = JSON.parse(fs.readFileSync(`results/pods${BLOCK}.json`));
  allBalances = JSON.parse(fs.readFileSync(`results/internal-balances${BLOCK}.json`));

  allAccounts = [...new Set([...Object.keys(allDeposits.accounts), ...Object.keys(allPlots), ...Object.keys(allBalances.accounts)])];

  const promiseGenerators = allAccounts.map(a => async () => ({
    input: a,
    output: await accountStruct(a)
  }));

  const accountsStorage = {};
  await runBatchPromises(promiseGenerators, 50, (result) => {
    accountsStorage[result.input] = result.output;
  });
  console.log('\rFinished accounts info');
  return accountsStorage;
}

async function accountStruct(account) {

  const [
    actualLastUpdate,
    lastSop,
    lastRain
  ] = await Promise.all([
    bs.s.a[account].lastUpdate,
    bs.s.a[account].lastSop,
    bs.s.a[account].lastRain
  ]);

  const stalk = BigInt(allDeposits.accounts[account]?.totals.stalkMinusGerminating ?? 0);
  const roots = stalk * BigInt(10 ** 12);

  const { deposits, depositIdList, mowStatuses } = getAccountSilo(account);
  const fields = {
    0: getAccountField(account)
  };

  const germinatingStalk = germinatingMapping(account, actualLastUpdate)
  const internalTokenBalance = getAccountInternalBalances(account);

  process.stdout.write(`\r${++walletProgress} / ${allAccounts.length}`);
  
  return {
    roots,
    stalk,
    depositPermitNonces: 0n,
    tokenPermitNonces: 0n,
    lastUpdate: currentSeason,
    lastSop,
    lastRain,
    // bytes32[16] _buffer_0,
    deposits,
    depositIdList,
    fields,
    depositAllowances: {},
    tokenAllowances: {},
    mowStatuses,
    isApprovedForAll: {},
    germinatingStalk,
    internalTokenBalance,
    // bytes32[16] _buffer_1,
    sop: {} // assumption being it doesnt sop before l2 migration
  }
}

function getAccountSilo(account) {
  const deposits = {};
  const depositIdList = {};
  const mowStatuses = {};
  for (const token in allDeposits.accounts[account]) {
    if (token === 'totals') {
      continue;
    }
    if (!depositIdList[l2Token(token)]) {
      depositIdList[l2Token(token)] = [];
    }
    for (const stem in allDeposits.accounts[account][token]) {
      const deposit = allDeposits.accounts[account][token][stem];
      const depositId = packAddressAndStem(l2Token(token), stem);
      deposits[depositId] = {
        amount: BigInt(deposit.l2Amount),
        bdv: BigInt(deposit.bdv)
      };
      depositIdList[l2Token(token)].push(depositId);
    }
    mowStatuses[l2Token(token)] = {
      // Sets to the stem tip, since all deposits were mown.
      lastStem: BigInt(allDeposits.totals.stemTips[token]),
      bdv: BigInt(allDeposits.accounts[account].totals[token].bdv)
    };
  }
  return {
    deposits,
    depositIdList,
    mowStatuses
  };
}

function getAccountField(account) {
  const field = {
    plots: {},
    plotIndexes: []
  };
  for (const index in allPlots[account]) {
    field.plots[index] = BigInt(allPlots[account][index].amount);
    field.plotIndexes.push(BigInt(index));
  }
  return field;
}

async function germinatingMapping(account, lastUpdate) {
  // if the last mowed season is less than the current season - 1,
  // then there are no germinating stalk and roots (as all germinating assets have finished).
  if (lastUpdate < currentSeason - 1n) {
    return {};
  }
  // Otherwise there is germinating stalk
  const [oddGerm, evenGerm] = await Promise.all([
    bs.s.a[account].farmerGerminating.odd,
    bs.s.a[account].farmerGerminating.even
  ]);
  return {
    0: oddGerm * BigInt(10 ** 6),
    1: evenGerm * BigInt(10 ** 6)
  };
}

function getAccountInternalBalances(account) {
  const internalTokenBalance = {};
  for (const token in allBalances.accounts[account]) {
    internalTokenBalance[l2Token(token)] = BigInt(allBalances.accounts[account][token].l2total);
  }
  return internalTokenBalance;
}

module.exports = {
  allAccountStructs
}