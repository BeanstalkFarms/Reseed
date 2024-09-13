const fs = require('fs');
const { BEANSTALK, BEAN, UNRIPE_BEAN, UNRIPE_LP, WETH, WSTETH, CRV3, BEANWETH, BEANWSTETH, BEAN3CRV } = require("./contracts/addresses");
const { getBalance } = require("./contracts/contract");
const { bigintDecimal } = require('./utils/json-formatter');

let BLOCK;

async function exportCirculating(block) {
  BLOCK = block;

  const amounts = await getCirculatingAmounts();

  const balancesOutFile = `results/contract-circulating${BLOCK}.json`;
  await fs.promises.writeFile(balancesOutFile, JSON.stringify(amounts, bigintDecimal, 2));
  console.log(`\rWrote contracts' circulating balances to ${balancesOutFile}`);
}

async function getCirculatingAmounts() {
  const [
    bsBeans,
    bsUrbeans,
    bsUrlps,
    beanwethBeans,
    beanwethWeth,
    beanwstethBeans,
    beanwstethWsteth,
    bean3crvBeans,
    bean3crv3crv
  ] = await Promise.all([
    getBalance(BEAN, BEANSTALK, BLOCK),
    getBalance(UNRIPE_BEAN, BEANSTALK, BLOCK),
    getBalance(UNRIPE_LP, BEANSTALK, BLOCK),
    getBalance(BEAN, BEANWETH, BLOCK),
    getBalance(WETH, BEANWETH, BLOCK),
    getBalance(BEAN, BEANWSTETH, BLOCK),
    getBalance(WSTETH, BEANWSTETH, BLOCK),
    getBalance(BEAN, BEAN3CRV, BLOCK),
    getBalance(CRV3, BEAN3CRV, BLOCK),
  ]);
  return {
    beanstalk: {
      beans: BigInt(bsBeans),
      unripeBeans: BigInt(bsUrbeans),
      unripeLp: BigInt(bsUrlps),
    },
    pools: {
      beanweth: {
        bean: BigInt(beanwethBeans),
        weth: BigInt(beanwethWeth),
      },
      beanwsteth: {
        bean: BigInt(beanwstethBeans),
        wsteth: BigInt(beanwstethWsteth),
      },
      bean3crv: {
        bean: BigInt(bean3crvBeans),
        '3crv': BigInt(bean3crv3crv)
      }
    }
  }
}

module.exports = {
  exportCirculating
};
