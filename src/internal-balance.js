const fs = require('fs');
const { BEANSTALK } = require('./contracts/addresses.js');
const { providerThenable } = require('./contracts/provider');
const storageLayout = require('./contracts/abi/storageLayout.json');
const ContractStorage = require('@beanstalk/contract-storage');
const { getWithdrawals, getCurrentInternalBalances, getUnpickedUnripe, getL2TokenAmount } = require('./utils/balances/balances-util.js');
const { WHITELISTED, WHITELISTED_LP } = require('./utils/silo/silo-util.js');
const { bigintHex } = require('./utils/json-formatter.js');

const BATCH_SIZE = 100;

let BLOCK;
let bs;

async function exportInternalBalances(block) {

  BLOCK = block;
  bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);

  const reducer = (a, next) => {
    for (token in next) {
      a[token] = (a[token] ?? 0n) + next[token];
    }
    return a;
  };

  console.log('Getting user internal balances...');
  const currentInternalBalances = await getCurrentInternalBalances(bs, BLOCK, BATCH_SIZE);
  const balancesByToken = Object.values(currentInternalBalances).reduce(reducer, {});
  
  console.log('Getting user unclaimed withdrawals...');
  const withdrawals = await getWithdrawals(bs, BLOCK, BATCH_SIZE);
  const withdrawalsByToken = Object.values(withdrawals).reduce(reducer, {});

  for (const token in withdrawalsByToken) {
    if (withdrawalsByToken[token] !== await bs.s.siloBalances[token].withdrawn) {
      console.log('[WARNING]: Mismatch between summation of user withdrawals and system-level withdrawals');
    }
  }

  console.log('Getting user unpicked unripe...');
  const unpicked = await getUnpickedUnripe(bs, BLOCK, BATCH_SIZE);
  const unpickedByToken = Object.values(unpicked).reduce(reducer, {});

  // TODO: unclaimed sprouts

  // Add withdrawals/unpicked into internal balances
  const allAccounts = [...new Set([
    ...Object.keys(currentInternalBalances),
    ...Object.keys(withdrawals),
    ...Object.keys(unpicked)
  ])];
  const breakdown = { 
    accounts: {},
    totals: {}
  };
  for (const account of allAccounts) {
    breakdown.accounts[account] = {};
    for (const token of WHITELISTED) {
      const sum =
        (currentInternalBalances[account]?.[token] ?? 0n) +
        (withdrawals[account]?.[token] ?? 0n) +
        (unpicked[account]?.[token] ?? 0n);
      if (sum > 0n) {
        breakdown.accounts[account][token] = {
          currentInternal: currentInternalBalances[account]?.[token] ?? 0n,
          withdrawn: withdrawals[account]?.[token] ?? 0n,
          unpicked: unpicked[account]?.[token] ?? 0n,
          total: sum,
          // Scales lp token amounts according to the amount minted on l2
          l2total: await getL2TokenAmount(token, sum, BLOCK)
        };
      }
    }
  }

  // Set totals
  for (const token of WHITELISTED) {
    const sum =
      (balancesByToken[token] ?? 0n) +
      (withdrawalsByToken[token] ?? 0n) +
      (unpickedByToken[token] ?? 0n);
    breakdown.totals[token] = {
      currentInternal: balancesByToken[token] ?? 0n,
      withdrawn: withdrawalsByToken[token] ?? 0n,
      unpicked: unpickedByToken[token] ?? 0n,
      total: sum,
      l2total: Object.keys(breakdown.accounts).reduce((a, next) => a + (breakdown.accounts[next][token]?.l2total ?? 0n), 0n)
    }
  }

  const balancesOutFile = `results/internal-balances${BLOCK}.json`;
  await fs.promises.writeFile(balancesOutFile, JSON.stringify(breakdown, bigintHex, 2));

  console.log(`\rWrote internal balances to ${balancesOutFile}`);
}

module.exports = {
  exportInternalBalances
}
