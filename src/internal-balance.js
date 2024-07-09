const fs = require('fs');
const { BEANSTALK } = require('./contracts/addresses.js');
const { providerThenable } = require('./contracts/provider');
const storageLayout = require('./contracts/abi/storageLayout.json');
const ContractStorage = require('@beanstalk/contract-storage');
const { runBatchPromises } = require('./utils/batch-promise.js');

const BATCH_SIZE = 100;
let BLOCK;
let bs;

//s.a[account].withdrawals[token][season]
async function exportInternalBalances(block) {

  BLOCK = block;
  bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);

  const reducer = (a, next) => {
    for (token in next) {
      a[token] = (a[token] ?? 0n) + next[token];
    }
    return a;
  };

  const currentInternalBalances = await getCurrentInternalBalances();
  const balancesByToken = Object.values(currentInternalBalances).reduce(reducer, {});
  
  // Calcualte withdrawal amounts
  const withdrawals = await getWithdrawals();
  const withdrawalsByToken = Object.values(withdrawals).reduce(reducer, {});

  for (const token in withdrawalsByToken) {
    if (withdrawalsByToken[token] !== await bs.s.siloBalances[token].withdrawn) {
      console.log('[WARNING]: Mismatch between summation of user withdrawals and system-level withdrawals');
    }
  }

  // Calculate unpicked unripe amounts

  // Add withdrawals/unpicked into internal balances

  // Scale lp token amounts according to the amount minted on l2
}

async function getCurrentInternalBalances() {
  const balancesData = fs.readFileSync(`inputs/internal-balances${BLOCK}.csv`, 'utf8');
  const entries = balancesData.split('\n').slice(1);
  const promiseGenerators = [];
  for (const entry of entries) {
    const [account, token] = entry.split(',');
    if (account) {
      promiseGenerators.push(async () => ({
        account,
        token,
        amount: BigInt(await bs.s.internalTokenBalance[account][token])
      }));
    }
  }

  const internalTokenBalances = {};
  await runBatchPromises(promiseGenerators, BATCH_SIZE, (result) => {
    if (result.amount > 0n) {
      if (!internalTokenBalances[result.account]) {
        internalTokenBalances[result.account] = {};
      }
      if (!internalTokenBalances[result.account][result.token]) {
        internalTokenBalances[result.account][result.token] = 0n;
      }
      internalTokenBalances[result.account][result.token] += result.amount;
    }
  });
  return internalTokenBalances;
}

async function getWithdrawals() {

  // Determine potential withdrawal accounts/seasons
  const withdrawalData = fs.readFileSync(`inputs/silo-withdrawn${BLOCK}.csv`, 'utf8');
  const entries = withdrawalData.split('\n').slice(1);
  const promiseGenerators = [];
  for (const entry of entries) {
    const [account, token, season] = entry.split(',');
    if (account) {
      promiseGenerators.push(async () => ({
        account,
        token,
        amount: BigInt(await bs.s.a[account].withdrawals[token][season])
      }));
    }
  }

  // Find withdrawn amounts on the account/token level
  const withdrawals = {};
  await runBatchPromises(promiseGenerators, BATCH_SIZE, (result) => {
    if (result.amount !== 0n) {
      if (!withdrawals[result.account]) {
        withdrawals[result.account] = {};
      }
      if (!withdrawals[result.account][result.token]) {
        withdrawals[result.account][result.token] = 0n;
      }
      withdrawals[result.account][result.token] += result.amount;
    }
  });
  return withdrawals;
}

module.exports = {
  exportInternalBalances
}
