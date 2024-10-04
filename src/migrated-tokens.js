const fs = require('fs');
const { BEANSTALK, BEAN, UNRIPE_BEAN, UNRIPE_LP, CRV3, BEANWETH, BEANWSTETH, BEAN3CRV } = require("./contracts/addresses");
const { getBalance } = require("./contracts/contract");
const { bigintDecimal } = require('./utils/json-formatter');
const { getRemoveLiquidityOut } = require('./utils/pool-data');
const { getUnripeBeanAdjustment } = require('./utils/silo/unripe-bean-adjustment');
const { getDuneResult } = require('./contracts/dune');

let BLOCK;

async function exportMigratedTokens(block) {
  BLOCK = block;

  const amounts = await getCirculatingAmounts();

  const balancesOutFile = `results/migrated-tokens${BLOCK}.json`;
  await fs.promises.writeFile(balancesOutFile, JSON.stringify(amounts, bigintDecimal, 2));
  console.log(`\rWrote contracts' circulating balances to ${balancesOutFile}`);

  // Originall I provided these values in a simple csv file, retain the same formatting for simplicity.
  const urbeanHolders = await getDuneResult(4045304, BLOCK);
  const urbeanOutFile = `results/urbean-holders${BLOCK}.csv`;
  await fs.promises.writeFile(urbeanOutFile, formatHoldersAsCsv(urbeanHolders));
  console.log(`Wrote Unripe Bean token holders to ${urbeanOutFile}`);

  const urlpHolders = await getDuneResult(4045324, BLOCK);
  const urlpOutFile = `results/urlp-holders${BLOCK}.csv`;
  await fs.promises.writeFile(urlpOutFile, formatHoldersAsCsv(urlpHolders));
  console.log(`Wrote Unripe LP token holders to ${urlpOutFile}`);
}

async function getCirculatingAmounts() {
  // TODO: set these values to deposited + farm + unripe lp's underlying
  const migratedBeanWethLp = 0;
  const migratedBeanWstethLp = 0;
  const [
    bsBeans,
    bsUrbeans,
    bsUrbeanAdjustment,
    bsUrlps,
    bsEthLp,
    bsWstethLp,
    bs3crvLp,
    beanwethMigrated,
    beanwstethMigrated
  ] = await Promise.all([
    getBalance(BEAN, BEANSTALK, BLOCK),
    getBalance(UNRIPE_BEAN, BEANSTALK, BLOCK),
    getUnripeBeanAdjustment(BLOCK),
    getBalance(UNRIPE_LP, BEANSTALK, BLOCK),
    getBalance(BEANWETH, BEANSTALK, BLOCK),
    getBalance(BEANWSTETH, BEANSTALK, BLOCK),
    getBalance(BEAN3CRV, BEANSTALK, BLOCK),
    getRemoveLiquidityOut(BEANWETH, migratedBeanWethLp, BLOCK),
    getRemoveLiquidityOut(BEANWSTETH, migratedBeanWstethLp, BLOCK),
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
        bean: BigInt(beanwethMigrated[0]),
        weth: BigInt(beanwethMigrated[1]),
      },
      beanwsteth: {
        bean: BigInt(beanwstethMigrated[0]),
        wsteth: BigInt(beanwstethMigrated[1]),
      },
      bean3crv: {
        bean: 'to be hardcoded elsewhere',
        usdc: 'to be hardcoded elsewhere'
      }
    }
  }
}

function formatHoldersAsCsv(duneResult) {
  let result = 'account,balance\n';
  for (const row of duneResult.result.rows) {
    result += `${row.account},${row.balance}\n`;
  }
  return result;
}

module.exports = {
  exportMigratedTokens
};
