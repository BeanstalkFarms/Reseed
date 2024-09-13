const ethers = require('ethers')
const { providerThenable, localProvider } = require('./provider.js');
const { Contract } = require('alchemy-sdk');
const { BEANSTALK, FERTILIZER, DECIMALS } = require('./addresses.js');
const beanAbi = require('./abi/beanstalk.json');
const erc20Abi = require('./abi/erc20.json');
const fertAbi = require('./abi/fertilizer.json');

const contracts = {};
async function getContractAsync(address, abi, { provider, isLocal = false }) {
  let network;
  if (!isLocal) {
    provider = await provider;
    network = (await provider.detectNetwork()).name;
  } else {
    network = 'local';
  }
  const key = JSON.stringify({ address, abi, network, isLocal });
  if (contracts[key] == null) {
    if (!isLocal) {
      contracts[key] = new Contract(address, abi, provider);
    } else {
      const contract = new ethers.Contract(address, abi, localProvider);
      const handler = {
        get: function(_, prop, _1) {
          if (prop === 'then') {
            return contract;
          } else if (prop === 'callStatic') {
            return new Proxy({}, {
              get: function(_, prop, _1) {
                return contract[prop];
              }
            });
          }
          return contract[prop];
        }
      };

      const proxyContract = new Proxy({}, handler);
      contracts[key] = proxyContract;
    }
  }
  return contracts[key];
}

// Generic for getting token balances
async function getBalance(token, holder, blockNumber = 'latest') {
  const erc20Contract = await getContractAsync(token, erc20Abi, { provider: providerThenable });
  const balance = await erc20Contract.callStatic.balanceOf(holder, { blockTag: blockNumber });
  balance.decimals = DECIMALS[token];
  return balance;
}

module.exports = {
  asyncBeanstalkContractGetter: async ({ provider, isLocal } = { provider: providerThenable, isLocal: false}) => getContractAsync(BEANSTALK, beanAbi, { provider, isLocal }),
  asyncFertContractGetter: async ({ provider, isLocal } = { provider: providerThenable, isLocal: false}) => getContractAsync(FERTILIZER, fertAbi, { provider, isLocal }),
  createAsyncERC20ContractGetter: (address, { provider, isLocal } = { provider: providerThenable, isLocal: false}) => async () => getContractAsync(address, erc20Abi, { provider, isLocal }),
  getContractAsync: async (address, abi, { provider, isLocal } = { provider: providerThenable, isLocal: false}) => getContractAsync(address, abi, { provider, isLocal }),
  getBalance: getBalance
};
