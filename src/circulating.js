const fs = require('fs');
const { BEANSTALK, BEAN, UNRIPE_BEAN, UNRIPE_LP, CRV3, BEANWETH, BEANWSTETH, BEAN3CRV } = require("./contracts/addresses");
const { getBalance } = require("./contracts/contract");
const { bigintDecimal } = require('./utils/json-formatter');
const { getWellReserves } = require('./utils/well-data');
const { getUnripeBeanAdjustment } = require('./utils/silo/unripe-bean-adjustment');

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
    bsUrbeanAdjustment,
    bsUrlps,
    bsEthLp,
    bsWstethLp,
    bs3crvLp,
    beanwethReserves,
    beanwstethReserves,
    bean3crvBeans,
    bean3crv3crv
  ] = await Promise.all([
    getBalance(BEAN, BEANSTALK, BLOCK),
    getBalance(UNRIPE_BEAN, BEANSTALK, BLOCK),
    getUnripeBeanAdjustment(BLOCK),
    getBalance(UNRIPE_LP, BEANSTALK, BLOCK),
    getBalance(BEANWETH, BEANSTALK, BLOCK),
    getBalance(BEANWSTETH, BEANSTALK, BLOCK),
    getBalance(BEAN3CRV, BEANSTALK, BLOCK),
    getWellReserves(BEANWETH, BLOCK),
    getWellReserves(BEANWSTETH, BLOCK),
    getBalance(BEAN, BEAN3CRV, BLOCK),
    getBalance(CRV3, BEAN3CRV, BLOCK),
  ]);
  return {
    beanstalk: {
      beans: BigInt(bsBeans) - bsUrbeanAdjustment.ripeUnderlying,
      unripeBeans: BigInt(bsUrbeans) - bsUrbeanAdjustment.unripeTokens,
      unripeLp: BigInt(bsUrlps),
      ethLp: BigInt(bsEthLp),
      wstethLp: BigInt(bsWstethLp),
      bs3crvLp: BigInt(bs3crvLp)
    },
    pools: {
      beanweth: {
        bean: BigInt(beanwethReserves[0]),
        weth: BigInt(beanwethReserves[1]),
      },
      beanwsteth: {
        bean: BigInt(beanwstethReserves[0]),
        wsteth: BigInt(beanwstethReserves[1]),
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
