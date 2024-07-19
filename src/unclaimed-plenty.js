const fs = require('fs');
const { BEANSTALK } = require('./contracts/addresses.js');
const beanstalkInitAbi = require('./contracts/abi/beanstalk-init.json');
const { getContractAsync } = require('./contracts/contract');
const storageLayout = require('./contracts/abi/storageLayout.json');
const ContractStorage = require('@beanstalk/contract-storage');
const retryable = require('./utils/retryable.js');
const { preReplantSiloAccounts } = require('../inputs/pre-replant-silo-accounts.js');
const { runBatchPromises } = require('./utils/batch-promise.js');
const { providerThenable } = require('./contracts/provider.js');
const { bigintHex } = require('./utils/json-formatter.js');

const EXPLOIT_BLOCK = 14602790;

// uint256 eth = s.a[account].sop.base.mul(s.sop.weth).div(s.sop.base);
// s.a[account].sop.base = balanceOfPlentyBase(account)
// s.sop.weth = s.deprecated[5]
// s.sop.base = s.deprecated[6]

let beanstalk;
let bs;

let sopWeth;
let sopBase;

let checkProgress = 0;
let unclaimedEth = {
  accounts: {},
  total: 0n
};

async function checkAccountPlenty(account) {
  const accountBase = await retryable(async () => 
    BigInt(await beanstalk.callStatic.balanceOfPlentyBase(account, { blockTag: EXPLOIT_BLOCK }))
  );
  if (accountBase > 0n) {
    const eth = accountBase * sopWeth / sopBase;
    unclaimedEth.accounts[account] = eth;
    unclaimedEth.total += eth;
  }
  process.stdout.write(`\r${++checkProgress}`);
}

async function identifyUnclaimedPlenty() {

  beanstalk = await getContractAsync(BEANSTALK, beanstalkInitAbi, { provider: providerThenable });
  bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, EXPLOIT_BLOCK);

  // Set system values
  [sopWeth, sopBase] = await Promise.all([
    bs.s.deprecated[5],
    bs.s.deprecated[6]
  ]);

  const total = preReplantSiloAccounts.length;
  console.log('Checking pre-exploit accounts for unclaimed plenty...');
  process.stdout.write(`\r0${' '.repeat((total).toString().length - 1)} / ${total}`);

  const promiseGenerators = preReplantSiloAccounts.map((account) => () => checkAccountPlenty(account));
  await runBatchPromises(promiseGenerators, 100);

  console.log(`\rChecked ${checkProgress} accounts`);

  const outFile = `results/unclaimed-plenty.json`;
  await fs.promises.writeFile(outFile, JSON.stringify(unclaimedEth, bigintHex, 2));

  console.log(`Total unclaimed plenty: ${unclaimedEth.total}`);
  console.log(`Unclaimed plenty exported to ${outFile}`);
}

identifyUnclaimedPlenty();