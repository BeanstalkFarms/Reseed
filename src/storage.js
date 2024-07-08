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

  systemStruct({
    block: BLOCK,
    beanstalk,
    bs
  });

}

module.exports = {
  exportStorage
}
