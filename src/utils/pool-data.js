const fs = require('fs');
const { ethers } = require('ethers');
const { BEANWETH, BEANWSTETH, BEAN3CRV } = require('../contracts/addresses');
const { getContractAsync } = require('../contracts/contract');
const { arbProviderThenable, providerThenable } = require('../contracts/provider');
const wellAbi = require('../contracts/abi/well.json');
const wellFnAbi = require('../contracts/abi/well-function.json');

const CP2_FN = '0xBA5104f2df98974A83CD10d16E24282ce6Bb647f';
const STABLE2_FN = '0xBA51055Ac3068Ffd884B495BF58314493cde9653';

async function getRemoveLiquidityOut(wellAddress, lpAmountIn, BLOCK) {
  const well = await getContractAsync(wellAddress, wellAbi, { provider: providerThenable });
  return await well.callStatic.getRemoveLiquidityOut(lpAmountIn, { blockTag: BLOCK });
}

async function calcL2LpTokenSupply(lpTokenAddressL1, BLOCK_L1) {
  // Use reserves on L1. For curve pool, assume 3crv -> USDC is 1:1
  // block number is ignored on the contract calls since they are made to arbitrum

  const circulatingBalances = JSON.parse(fs.readFileSync(`results/migrated-tokens${BLOCK_L1}.json`));

  if (lpTokenAddressL1 === BEAN3CRV) {
    const wellFunction = await getContractAsync(STABLE2_FN, wellFnAbi, { provider: arbProviderThenable });
    const beanUsdcReserves = fs.readFileSync(`inputs/bean-usdc-reserves.txt`, 'utf8').split(',').map(BigInt);
    const abiCoder = new ethers.AbiCoder();
    return await wellFunction.callStatic.calcLpTokenSupply(
      [beanUsdcReserves[0], beanUsdcReserves[1]],
      abiCoder.encode(['uint8', 'uint8'], [6, 6])
    );
  } else {
    const wellFunction = await getContractAsync(CP2_FN, wellFnAbi, { provider: arbProviderThenable });
    const reserves = Object.values(circulatingBalances.pools[LP_NAME_MAPPING[lpTokenAddressL1]]);
    return await wellFunction.callStatic.calcLpTokenSupply(reserves, '0x00');
  }
}

// Simplifies access to migrated-tokens output
const LP_NAME_MAPPING = {
  [BEANWETH]: 'beanweth',
  [BEANWSTETH]: 'beanwsteth',
  [BEAN3CRV]: 'bean3crv'
};

module.exports = {
  getRemoveLiquidityOut,
  calcL2LpTokenSupply
};
