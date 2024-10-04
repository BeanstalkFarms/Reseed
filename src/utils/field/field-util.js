const fs = require('fs');

function getHarvestablePods(block) {
  const harvestablePods = JSON.parse(fs.readFileSync(`results/pods-harvestable${block}.json`));
  return harvestablePods.reduce((a, next) => a + BigInt(next.harvestablePods), 0n);
}

module.exports = {
  getHarvestablePods
};
