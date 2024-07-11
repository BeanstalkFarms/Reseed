const ethers = require('ethers');
require('dotenv').config();
const { Network, Alchemy } = require('alchemy-sdk');

const mainnet = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
});

const arb = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ARB_MAINNET,
});

// Wrapper to support getStorageAt (available on alchemy provider but not ethers)
class LocalProvider extends ethers.JsonRpcProvider {
  constructor(rpcUrl) {
    super(rpcUrl);
  }

  async getStorageAt(address, position, block = 'latest') {
    if (typeof block === 'number') {
      block = "0x" + block.toString(16);
    }
    return await this.send('eth_getStorageAt', [address, "0x" + position.toString(16), block]);
  }
}
const localProvider = new LocalProvider('http://127.0.0.1:8545');

module.exports = {
  alchemy: mainnet,
  localProvider,
  providerThenable: mainnet.config.getProvider(),
  arbProviderThenable: arb.config.getProvider()
};
