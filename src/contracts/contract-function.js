const { alchemy } = require('./provider.js');
const { Contract } = require('alchemy-sdk');
const { BEANSTALK, FERTILIZER, DECIMALS } = require('./addresses.js');
const beanAbi = require('./abi/beanstalk.json');
const erc20Abi = require('./abi/erc20.json');
const fertAbi = require('./abi/fertilizer.json');

const contracts = {};
async function getContractAsync(address, abi) {
  const key = JSON.stringify({ address, abi });
  if (contracts[key] == null) {
    contracts[key] = new Contract(address, abi, await alchemy.config.getProvider());
  }
  return contracts[key];
}

// Generic for getting token balances
async function getBalance(token, holder, blockNumber = 'latest') {
  const erc20Contract = await getContractAsync(token, erc20Abi);
  const balance = await erc20Contract.callStatic.balanceOf(holder, { blockTag: blockNumber });
  balance.decimals = DECIMALS[token];
  return balance;
}

module.exports = {
  asyncBeanstalkContractGetter: async () => getContractAsync(BEANSTALK, beanAbi),
  asyncFertContractGetter: async () => getContractAsync(FERTILIZER, fertAbi),
  createAsyncERC20ContractGetter: (address) => async () => getContractAsync(address, erc20Abi),
  getContractAsync: getContractAsync,
  getBalance: getBalance
};
