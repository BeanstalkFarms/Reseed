const fs = require('fs');
const { runBatchPromises } = require('../batch-promise');
const { BEAN, UNRIPE_BEAN, UNRIPE_LP, BEAN3CRV } = require('../../contracts/addresses.js');
const { WHITELISTED } = require('../silo/silo-util.js');

async function getCurrentInternalBalances(bs, BLOCK, BATCH_SIZE) {
  const balancesData = fs.readFileSync(`inputs/internal-balances${BLOCK}.csv`, 'utf8');
  const entries = balancesData.split('\n').slice(1);
  const promiseGenerators = [];
  for (const entry of entries) {
    const [account, token] = entry.split(',');
    if (account && WHITELISTED.includes(token)) {
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

async function getWithdrawals(bs, BLOCK, BATCH_SIZE) {

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

async function getUnpickedUnripe(bs, BLOCK, BATCH_SIZE) {

  const beanMerkle = JSON.parse(fs.readFileSync(`inputs/unripe-beans-merkle.json`));
  const lpMerkle = JSON.parse(fs.readFileSync(`inputs/unripe-lp-merkle.json`));

  const unpicked = {};
  const promiseGenerators = [];

  const promiseFactory = (token, account, merkle) => async () => {
    if (!(await bs.s.unripeClaimed[token][account])) {
      return {
        account,
        token,
        amount: BigInt(merkle[account].amount)
      };
    }
  }

  for (const account in beanMerkle) {
    promiseGenerators.push(promiseFactory(UNRIPE_BEAN, account, beanMerkle));
  }

  for (const account in lpMerkle) {
    promiseGenerators.push(promiseFactory(UNRIPE_LP, account, lpMerkle));
  }

  await runBatchPromises(promiseGenerators, BATCH_SIZE, (result) => {
    if (result) {
      if (!unpicked[result.account]) {
        unpicked[result.account] = {};
      }
      unpicked[result.account][result.token] = result.amount;
    }
  });
  return unpicked;
}

module.exports = {
  getCurrentInternalBalances,
  getWithdrawals,
  getUnpickedUnripe
}