const { alchemy } = require('./provider.js');
const { Contract } = require('alchemy-sdk');
const { BEANSTALK, FERTILIZER, DECIMALS } = require('./addresses.js');
const beanAbi = require('./abi/beanstalk.json');
const erc20Abi = require('./abi/erc20.json');
const fertAbi = require('./abi/fertilizer.json');

const contracts = {};
async function getContractAsync(address, abi, isLocal = false) {
  const key = JSON.stringify({ address, abi, isLocal });
  if (contracts[key] == null) {
    if (!isLocal) {
      contracts[key] = new Contract(address, abi, await alchemy.config.getProvider());
    } else {
      const provider = new ethers.JsonRpcProvider('http://localhost:8545');
      const contract = new ethers.Contract(address, abi, provider);
      const handler = {
          get: function(target, prop, receiver) {
              if (prop === 'callStatic') {
                  return new Proxy(target, {
                      get: function(target, method, receiver) {
                          if (typeof target[method] === 'function') {
                              return target[method].bind(target);
                          }
                          return Reflect.get(target, method, receiver);
                      }
                  });
              }
              return Reflect.get(target, prop, receiver);
          }
      };
      const proxyContract = new Proxy(contract, handler);
      contracts[key] = proxyContract;
    }
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
