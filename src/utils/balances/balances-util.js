const fs = require('fs');
const { runBatchPromises } = require('../batch-promise');
const { BEAN, UNRIPE_BEAN, UNRIPE_LP } = require('../../contracts/addresses.js');
const { WHITELISTED, WHITELISTED_LP } = require('../silo/silo-util.js');
const { createAsyncERC20ContractGetter } = require('../../contracts/contract.js');
const { l2Token } = require('../token.js');
const { getDuneResult } = require('../../contracts/dune.js');
const { calcL2LpTokenSupply } = require('../pool-data.js');

async function getCurrentInternalBalances(bs, BLOCK, BATCH_SIZE) {
  const balancesData = await getDuneResult(3907145, BLOCK);
  const promiseGenerators = [];
  for (const entry of balancesData.result.rows) {
    const [account, token] = [entry.account, entry.token];
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

function getTotalInternalBalance(token, BLOCK) {
  const balancesFile = JSON.parse(fs.readFileSync(`results/internal-balances${BLOCK}.json`));
  return BigInt(balancesFile.totals[token].total);
}

async function getWithdrawals(bs, BLOCK, BATCH_SIZE) {

  // Determine potential withdrawal accounts/seasons
  const siloWithdrawn = await getDuneResult(3906871, BLOCK);
  const promiseGenerators = [];
  for (const entry of siloWithdrawn.result.rows) {
    const [account, token, season] = [entry.account, entry.token, entry.season];
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
        account: account.toLowerCase(),
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

// Returns in the same format as the above methods for ease of use. In practice only Beans can be rinsed.
function getRinsableUserSprouts(BLOCK) {
  const fertData = JSON.parse(fs.readFileSync(`results/fert${BLOCK}.json`)).accounts;
  return Object.keys(fertData).reduce((a, next) => {
    let sumRinsable = 0n;
    for (const fertId in fertData[next]) {
      sumRinsable += BigInt(fertData[next][fertId].rinsableSprouts);
    }
    a[next] = {
      [BEAN]: sumRinsable
    };
    return a;
  }, {});
}

// Using the percentage of the given amount against the total token supply on Ethereum,
// returns the corresponding share of tokens on L2.
const l1TokenSupply = {};
const l2TokenSupply = {};
async function getL2TokenAmount(token, amount, BLOCK) {

  if (amount === 0n) {
    return 0n;
  }

  if (!l1TokenSupply[token]) {
    const tokenContract = await createAsyncERC20ContractGetter(token)();
    l1TokenSupply[token] = BigInt(await tokenContract.callStatic.totalSupply({ blockTag: BLOCK }));
  }
  const l1percent = Number(amount) / Number(l1TokenSupply[token]);

  let l2amount;
  if (WHITELISTED_LP.includes(token)) {
    const l2TokenAddr = l2Token(token);
    if (!l2TokenSupply[l2TokenAddr]) {
      l2TokenSupply[l2TokenAddr] = await calcL2LpTokenSupply(token, BLOCK);
    }
    l2amount = BigInt(Math.floor(l1percent * Number(l2TokenSupply[l2TokenAddr])));
  } else {
    // Amount shouldnt change for non lp
    l2amount = amount;
  }
  return l2amount;
}

module.exports = {
  getCurrentInternalBalances,
  getTotalInternalBalance,
  getWithdrawals,
  getUnpickedUnripe,
  getRinsableUserSprouts,
  getL2TokenAmount
}