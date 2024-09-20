const fs = require('fs');
const { ethers } = require('ethers');
const { BEANWETH, BEANWSTETH, BEAN3CRV } = require("../contracts/addresses");
const { getContractAsync } = require("../contracts/contract");
const { arbProviderThenable, providerThenable } = require("../contracts/provider");
const wellAbi = require('../contracts/abi/well.json');
const wellFnAbi = require('../contracts/abi/well-function.json');
const curveAbi = require('../contracts/abi/curve.json');

const CP2_FN = "0xBA5104f2df98974A83CD10d16E24282ce6Bb647f";
const STABLE2_FN = "0xBA51055Ac3068Ffd884B495BF58314493cde9653";

async function getWellReserves(wellAddress, BLOCK) {
  const well = await getContractAsync(wellAddress, wellAbi, { provider: providerThenable });
  return await well.callStatic.getReserves({ blockTag: BLOCK });
}

async function getCurveReserves(curvePool, BLOCK) {
  const curve = await getContractAsync(curvePool, curveAbi, { provider: providerThenable });
  return await curve.callStatic.get_balances({ blockTag: BLOCK });
}

async function calcL2LpTokenSupply(lpTokenAddressL1, BLOCK_L1) {
  // Use reserves on L1. For curve pool, assume 3crv -> USDC is 1:1
  // block number is ignored on the contract calls since they are made to arbitrum

  const circulatingBalances = JSON.parse(fs.readFileSync(`results/contract-circulating${BLOCK_L1}.json`));

  if (lpTokenAddressL1 === BEAN3CRV) {
    const wellFunction = await getContractAsync(STABLE2_FN, wellFnAbi, { provider: arbProviderThenable });
    const usdcReserves = BigInt(fs.readFileSync(`inputs/usdc-reserves.txt`));
    const abiCoder = new ethers.AbiCoder();
    return await wellFunction.callStatic.calcLpTokenSupply(
      [
        BigInt(circulatingBalances.pools.bean3crv.bean),
        usdcReserves
      ],
      abiCoder.encode(
        ["uint8", "uint8"],
        [6, 6]
      )
    )
  } else {
    const wellFunction = await getContractAsync(CP2_FN, wellFnAbi, { provider: arbProviderThenable });
    const reserves = Object.values(circulatingBalances.pools[LP_NAME_MAPPING[lpTokenAddressL1]]);
    return await wellFunction.callStatic.calcLpTokenSupply(reserves, "0x00")
  }
}

// Simplifies access to contract-circulating output
const LP_NAME_MAPPING = {
  [BEANWETH]: 'beanweth',
  [BEANWSTETH]: 'beanwsteth',
  [BEAN3CRV]: 'bean3crv'
};

module.exports = {
  getWellReserves,
  getCurveReserves,
  calcL2LpTokenSupply
};
