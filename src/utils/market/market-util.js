const fs = require('fs');

function getAmountInOrders(block) {
  const market = JSON.parse(fs.readFileSync(`results/market${block}.json`));
  return Object.keys(market.orders.beanstalk3).reduce((a, next) => a + BigInt(market.orders.beanstalk3[next]), 0n);
}

module.exports = {
  getAmountInOrders
};
