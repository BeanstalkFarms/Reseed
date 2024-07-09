const fs = require('fs');
const { packAddressAndStem } = require('../silo/silo-util');

let BLOCK;
let bs;

let allDeposits;
let allPlots;

async function allAccountStructs(options) {

  console.log('Gathering accounts info...');

  BLOCK = options.block;
  bs = options.bs;

  // Load the balance result files (need to have already been computed)
  allDeposits = JSON.parse(fs.readFileSync(`results/deposits${BLOCK}.json`));
  allPlots = JSON.parse(fs.readFileSync(`results/pods${BLOCK}.json`));

  const allAccounts = [...new Set([...Object.keys(allDeposits), ...Object.keys(allPlots)])];

  const promiseGenerators = allAccounts.map(a => async () => ({
    input: a,
    output: await accountStruct(a)
  }));

  const accountsStorage = {}; 
  while (promiseGenerators.length > 0) {
    const results = await Promise.all(promiseGenerators.splice(0, Math.min(50, promiseGenerators.length)).map(p => p()));
    for (const result of results) {
      accountsStorage[result.input] = result.output;
    }
  }
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

  const stalk = BigInt(allDeposits[account].totals.stalkNotGerminating);
  const roots = stalk * BigInt(10 ** 12);

  const { deposits, depositIdList, mowStatuses } = getAccountSilo(account);
  const fields = {
    0: getAccountField(account)
  };
  
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
    if (!depositIdList[token]) {
      depositIdList[token] = [];
    }
    for (const stem in allDeposits[account][token]) {
      const deposit = allDeposits[account][token][stem];
      const depositId = packAddressAndStem(token, stem);
      deposits[depositId] = {
        amount: deposit.amount,
        bdv: deposit.bdv
      };
      depositIdList[token].push(depositId);
    }
    mowStatuses[token] = {
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
    field.plots[index] = BigInt(allPlots[account][index]);
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

module.exports = {
  allAccountStructs
}