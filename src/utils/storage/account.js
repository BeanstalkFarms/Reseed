const fs = require('fs');

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
    const results = await Promise.all(promiseGenerators.splice(0, Math.min(100, promiseGenerators.length)).map(p => p()));
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
    lastRain
  ] = await Promise.all([
    bs.s.a[account].lastUpdate,
    bs.s.a[account].lastSop,
    bs.s.a[account].lastRain
  ]);

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
    sop
  }
}

module.exports = {
  allAccountStructs
}