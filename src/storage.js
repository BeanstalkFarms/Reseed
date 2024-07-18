const fs = require('fs');
const { BEANSTALK } = require('./contracts/addresses.js');
const { providerThenable } = require('./contracts/provider.js');
const { tokenEq } = require('./utils/token.js');
const { bigintHex, bigintDecimal, addressChecksum } = require('./utils/json-formatter.js');
const { asyncBeanstalkContractGetter } = require('./contracts/contract.js');
const retryable = require('./utils/retryable.js');
const storageLayout = require('./contracts/abi/storageLayout.json');
const ContractStorage = require('@beanstalk/contract-storage');
const { systemStruct } = require('./utils/storage/system.js');
const { allAccountStructs } = require('./utils/storage/account.js');
const { fertilizerStorageBalances } = require('./utils/storage/fertilizer.js');

let BLOCK;
let beanstalk;
let bs;

async function exportStorage(block) {
  
  BLOCK = block;

  beanstalk = await asyncBeanstalkContractGetter();
  bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);

  const fertilizer = fertilizerStorageBalances(BLOCK);
  const fertilizerOutFile = `results/storage-fertilizer${BLOCK}.json`;
  await fs.promises.writeFile(fertilizerOutFile, addressChecksum(JSON.stringify(fertilizer, bigintHex, 2)));
  console.log(`\rWrote fertilizer storage to ${fertilizerOutFile}`);

  const accounts = await allAccountStructs({
    block: BLOCK,
    bs
  });

  const accountOutFile = `results/storage-accounts${BLOCK}.json`;
  await fs.promises.writeFile(accountOutFile, addressChecksum(JSON.stringify(accounts, bigintHex, 2)));
  console.log(`\rWrote account storage to ${accountOutFile}`);

  const system = await systemStruct({
    block: BLOCK,
    bs
  });

  // Consider combining into a single out file?
  const systemOutFile = `results/storage-system${BLOCK}.json`;
  await fs.promises.writeFile(systemOutFile, addressChecksum(JSON.stringify(system, bigintHex, 2)));
  console.log(`\rWrote system storage to ${systemOutFile}`);

}

module.exports = {
  exportStorage
}
