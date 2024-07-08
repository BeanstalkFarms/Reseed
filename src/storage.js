const fs = require('fs');
const { BEANSTALK, BEAN, UNRIPE_BEAN, UNRIPE_LP, BEAN3CRV, BEANWETH } = require('./contracts/addresses.js');
const { providerThenable } = require('./contracts/provider.js');
const { tokenEq } = require('./utils/token.js');
const { bigintHex, bigintDecimal } = require('./utils/json-formatter.js');
const { asyncBeanstalkContractGetter } = require('./contracts/contract.js');
const retryable = require('./utils/retryable.js');
const storageLayout = require('./contracts/abi/storageLayout.json');
const ContractStorage = require('@beanstalk/contract-storage');
const { systemStruct } = require('./utils/storage/system.js');

let BLOCK;
let beanstalk;
let bs;

async function exportStorage(block) {
  
  BLOCK = block;

  beanstalk = await asyncBeanstalkContractGetter();
  bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);

  const system = await systemStruct({
    block: BLOCK,
    beanstalk,
    bs
  });

  const outFile = `results/storage${BLOCK}.json`;
  await fs.promises.writeFile(outFile, JSON.stringify(system, bigintHex, 2));

  console.log(`\rWrote system storage to ${outFile}`);

}

module.exports = {
  exportStorage
}
