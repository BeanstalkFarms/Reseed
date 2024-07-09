const fs = require('fs');
const { BEANSTALK } = require('./contracts/addresses.js');
const { providerThenable } = require('./contracts/provider');
const storageLayout = require('./contracts/abi/storageLayout.json');
const ContractStorage = require('@beanstalk/contract-storage');

const BATCH_SIZE = 100;
let BLOCK;
let bs;

//s.a[account].withdrawals[token][season]
async function exportInternalBalances(block) {

  BLOCK = block;
  bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);

  // Main logic is TODO
  
  // Calcualte withdrawal amounts
  const withdrawals = await getWithdrawals();
  const withdrawalsByToken = Object.values(withdrawals).reduce((a, next) => {
    for (token in next) {
      a[token] = (a[token] ?? 0n) + next[token];
    }
    return a;
  }, {});

  for (const token in withdrawalsByToken) {
    if (withdrawalsByToken[token] !== await bs.s.siloBalances[token].withdrawn) {
      console.log('[WARNING]: Mismatch between summation of user withdrawals and system-level withdrawals');
    }
  }

  // Add withdrawals into internal balances
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
  while (promiseGenerators.length > 0) {
    const results = await Promise.all(promiseGenerators.splice(0, Math.min(BATCH_SIZE, promiseGenerators.length)).map(p => p()));
    for (const result of results) {
      if (result.amount !== 0n) {
        if (!withdrawals[result.account]) {
          withdrawals[result.account] = {};
        }
        if (!withdrawals[result.account][result.token]) {
          withdrawals[result.account][result.token] = 0n;
        }
        withdrawals[result.account][result.token] += result.amount;
      }
    }
  }
  return withdrawals;
}

module.exports = {
  exportInternalBalances
}
