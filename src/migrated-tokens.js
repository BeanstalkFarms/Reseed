const fs = require('fs');
const {
  BEANSTALK,
  BEAN,
  UNRIPE_BEAN,
  UNRIPE_LP,
  CRV3,
  BEANWETH,
  BEANWSTETH,
  BEAN3CRV
} = require('./contracts/addresses');
const { getBalance, asyncBeanstalkContractGetter } = require('./contracts/contract');
const { bigintDecimal } = require('./utils/json-formatter');
const { getRemoveLiquidityOut } = require('./utils/pool-data');
const { getUnripeBeanAdjustment } = require('./utils/silo/unripe-bean-adjustment');
const { getDuneResult } = require('./contracts/dune');
const { getTotalDepositedAmount } = require('./utils/silo/silo-util');
const { getTotalInternalBalance } = require('./utils/balances/balances-util');

let BLOCK;

async function exportMigratedTokens(block) {
  BLOCK = block;

  const amounts = await getCirculatingAmounts();

  const balancesOutFile = `results/migrated-tokens${BLOCK}.json`;
  await fs.promises.writeFile(balancesOutFile, JSON.stringify(amounts, bigintDecimal, 2));
  console.log(`\rWrote migrated token amounts to ${balancesOutFile}`);

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
  //// Commented out portions due to EBIP during migration ////
  // Migrated LP tokens is deposited + farm + unripe lp's underlying
  const beanstalk = await asyncBeanstalkContractGetter();
  const underlyingLp = BigInt(await beanstalk.getTotalUnderlying(UNRIPE_LP, { blockTag: BLOCK }));
  // const migratedBeanWethLp = getTotalDepositedAmount(BEANWETH, BLOCK) + getTotalInternalBalance(BEANWETH, BLOCK);
  const migratedBeanWstethLp =
    getTotalDepositedAmount(BEANWSTETH, BLOCK) + getTotalInternalBalance(BEANWSTETH, BLOCK) + underlyingLp;
  // console.log({
  //   underlyingLp,
  //   migratedBeanWethLp,
  //   migratedBeanWstethLp
  // });
  const [
    bsBeans,
    bsUrbeans,
    bsUrbeanAdjustment,
    bsUrlps,
    // bsEthLp,
    // bsWstethLp,
    // bs3crvLp
    // beanwethMigrated,
    beanwstethMigrated
  ] = await Promise.all([
    getBalance(BEAN, BEANSTALK, BLOCK),
    getBalance(UNRIPE_BEAN, BEANSTALK, BLOCK),
    getUnripeBeanAdjustment(BLOCK),
    getBalance(UNRIPE_LP, BEANSTALK, BLOCK),
    // getBalance(BEANWETH, BEANSTALK, BLOCK),
    // getBalance(BEANWSTETH, BEANSTALK, BLOCK),
    // getBalance(BEAN3CRV, BEANSTALK, BLOCK)
    // getRemoveLiquidityOut(BEANWETH, migratedBeanWethLp, BLOCK),
    getRemoveLiquidityOut(BEANWSTETH, migratedBeanWstethLp, BLOCK)
  ]);
  console.log('beanwsteth migrated:', beanwstethMigrated); // Informational only
  return {
    beanstalk: {
      beans: BigInt(bsBeans) - bsUrbeanAdjustment.ripeUnderlying,
      unripeBeans: BigInt(bsUrbeans) - bsUrbeanAdjustment.unripeTokens,
      unripeLp: BigInt(bsUrlps)
      // ethLp: BigInt(bsEthLp),
      // wstethLp: BigInt(bsWstethLp),
      // bs3crvLp: BigInt(bs3crvLp)
    },
    pools: {
      beanweth: {
        bean: 95114433736n,
        weth: 17368572494882417988n
      },
      beanwsteth: {
        bean: 14312184639527n,
        wsteth: 2189190465707058218485n
      },
      bean3crv: {
        bean: 'to be hardcoded elsewhere',
        usdc: 'to be hardcoded elsewhere'
      }
    }
  };
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
