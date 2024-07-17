const fs = require('fs');
const { packAddressAndStem } = require('../silo/silo-util');
const { runBatchPromises } = require('../batch-promise');
const { l2TokenMapping } = require('../balances/balances-util');
const { l2Token } = require('../token');

let BLOCK;
let bs;

let allDeposits;
let allPlots;
let allAccounts;

let walletProgress = 0;

async function allAccountStructs(options) {

  console.log('Gathering accounts info...');

  BLOCK = options.block;
  bs = options.bs;

  // Load the balance result files (need to have already been computed)
  allDeposits = JSON.parse(fs.readFileSync(`results/deposits${BLOCK}.json`));
  allPlots = JSON.parse(fs.readFileSync(`results/pods${BLOCK}.json`));
  allBalances = JSON.parse(fs.readFileSync(`results/internal-balances${BLOCK}.json`));

  allAccounts = [...new Set([...Object.keys(allDeposits), ...Object.keys(allPlots), ...Object.keys(allBalances.accounts)])];

  const promiseGenerators = allAccounts.map(a => async () => ({
    input: a,
    output: await accountStruct(a)
  }));

  const accountsStorage = {};
  await runBatchPromises(promiseGenerators, 50, (result) => {
    accountsStorage[result.input] = result.output;
  });
  console.log('Finished accounts info');
  return accountsStorage;
}

async function accountStruct(account) {

  const [
    lastUpdate,
    lastSop,
    lastRain,
    germinatingStalk 
  ] = await Promise.all([
    bs.s.a[account].lastUpdate,
    bs.s.a[account].lastSop,
    bs.s.a[account].lastRain,
    germinatingMapping(account)
  ]);

  const stalk = BigInt(allDeposits[account]?.totals.stalkNotGerminating ?? 0);
  const roots = stalk * BigInt(10 ** 12);

  const { deposits, depositIdList, mowStatuses } = getAccountSilo(account);
  const fields = {
    0: getAccountField(account)
  };

  const internalTokenBalance = getAccountInternalBalances(account);

  process.stdout.write(`\r${++walletProgress} / ${allAccounts.length}`);
  
  return {
    roots,
    stalk,
    depositPermitNonces: 0n,
    tokenPermitNonces: 0n,
    lastUpdate,
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
  for (const token in allDeposits[account]) {
    if (token === 'totals') {
      continue;
    }
    if (!depositIdList[l2Token(token)]) {
      depositIdList[l2Token(token)] = [];
    }
    for (const stem in allDeposits[account][token]) {
      const deposit = allDeposits[account][token][stem];
      const depositId = packAddressAndStem(l2Token(token), stem);
      deposits[depositId] = {
        amount: deposit.l2Amount,
        bdv: deposit.bdv
      };
      depositIdList[l2Token(token)].push(depositId);
    }
    mowStatuses[l2Token(token)] = {
      lastStem: allDeposits[account].totals[token].mowStem,
      bdv: allDeposits[account].totals[token].bdv
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

async function germinatingMapping(account) {
  const [oddGerm, evenGerm] = await Promise.all([
    bs.s.a[account].farmerGerminating.odd,
    bs.s.a[account].farmerGerminating.even
  ]);
  return {
    0: oddGerm,
    1: evenGerm
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