const { UNRIPE_BEAN } = require('../../contracts/addresses.js');
const { asyncBeanstalkContractGetter } = require('../../contracts/contract');

// This is the amount of extra unripe beans which were erroneously created during the Replant.
// A proportional amount of Ripe beans must be offset as well, though that must be calculated on chain at the time.
const UNRIPE_BEAN_ADJUSTMENT = BigInt(11294722670839);

async function getUnripeBeanAdjustment(BLOCK) {
  const beanstalkContract = await asyncBeanstalkContractGetter();
  return {
    unripeTokens: UNRIPE_BEAN_ADJUSTMENT,
    ripeUnderlying: BigInt(
      await beanstalkContract.callStatic.getUnderlying(UNRIPE_BEAN, UNRIPE_BEAN_ADJUSTMENT, { blockTag: BLOCK })
    )
  };
}

module.exports = {
  getUnripeBeanAdjustment
};
