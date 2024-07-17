const fs = require('fs');

/// Corrects the discrepancies introduced at the replant described here
/// https://www.notion.so/beanstalk-farms/Discrepancy-Active-Fert-Sprouts-in-Contract-f8fccb34664c46299adb8be93a062ab7
async function getActualActiveFertilizer(bs) {
  return await bs.s.activeFertilizer - BigInt(147);
}

async function getActualFertilizedIndex(bs) {
  return await bs.s.fertilizedIndex - BigInt(147) * await bs.s.bpf;
}

async function getActualUnfertilizedIndex(bs) {
  return await bs.s.unfertilizedIndex - (BigInt(882) - BigInt(147) * await bs.s.bpf);
}
///

function getRinsableSprouts(block) {
  const fertData = JSON.parse(fs.readFileSync(`results/fert${block}.json`));
  return BigInt(fertData.totals.sumRinsable);
}

function getClaimedSprouts(block) {
  const fertData = JSON.parse(fs.readFileSync(`results/fert${block}.json`));
  return BigInt(fertData.totals.sumClaimed);
}

module.exports = {
  getActualActiveFertilizer,
  getActualFertilizedIndex,
  getActualUnfertilizedIndex,
  getRinsableSprouts,
  getClaimedSprouts
}
