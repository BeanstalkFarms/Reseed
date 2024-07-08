const fs = require('fs');
const { plentySeasons } = require('../../../inputs/plenty-seasons.js');
const { BEANWETH } = require('../../contracts/addresses.js');
const { getActualActiveFertilizer, getActualFertilizedIndex, getActualUnfertilizedIndex, getClaimedFert } = require('../barn/barn-util.js');
const { tokenEq } = require('../token.js');

let BLOCK;
let beanstalk;
let bs;

async function systemStruct(options) {

  console.log('Gathering system info...');

  BLOCK = options.block;
  beanstalk = options.beanstalk;
  bs = options.bs;

  const [
    soil,
    beanSown,
    beanWethSnapshot,
    beanWethTwaReserves,
    casesV2
  ] = await Promise.all([
    bs.s.f.soil,
    bs.s.f.beanSown,
    bs.s.wellOracleSnapshots[BEANWETH],
    twaReservesStruct(BEANWETH),
    bs.s.deprecated2// bs.s.casesV2 TODO: using shorter array because its faster for testing
  ]);


  const market = JSON.parse(fs.readFileSync(`results/market${BLOCK}.json`));
  const podListings = {
    0: {}
  }
  const podOrders = {};
  for (const listIndex in market.listings.beanstalk3) {
    podListings[0][listIndex] = market.listings.beanstalk3[listIndex];
  }
  for (const orderId in market.orders.beanstalk3) {
    podOrders[orderId] = market.orders.beanstalk3[orderId];
  }

  const wellOracleSnapshots = {
    [BEANWETH]: beanWethSnapshot
    // TODO: BEANwstETH
  };

  const twaReserves = {
    [BEANWETH]: beanWethTwaReserves
    // TODO: BEANwstETH
  };

  const usdTokenPrice = {
    [BEANWETH]: 1
    // TODO: BEANwstETH?
  };

  // These are all 0 even for seasons in which a plenty did occur
  const sops = (await Promise.all(
    plentySeasons.map(async s => ([
      [s], await bs.s.sops[s]
    ]))
  )).reduce((a, next) => {
    a[next[0]] = next[1]
    return a;
  }, {});

  // I dont think these are necessary on migration ?
  const convertCapacity = {};
  const oracleImplementation = {};
  const shipmentRoutes = {};

  const [
    silo,
    field0,
    fert,
    season,
    weather,
    seedGauge,
    rain,
    migration,
    seedGaugeSettings,
    sop
  ] = await Promise.all([
    siloStruct(),
    fieldStruct(),
    fertilizerStruct(),
    seasonStruct(),
    weatherStruct(),
    seedGaugeStruct(),
    rainStruct(),
    migrationStruct(),
    seedGaugeSettingsStruct(),
    seasonOfPlentyStruct()
  ]);

  const fields = {
    0: field0
  };

  return {
    paused: false,
    pausedAt: 0,
    reentrantStatus: 0, // ?
    isFarm: 0, // ?
    ownerCandidate: null, // address?
    plenty: 0, // ?
    soil,
    beanSown,
    activeField: 0,
    fieldCount: 1,
    // bytes32[16] _buffer_0;
    podListings,
    podOrders,
    // internalTokenBalanceTotal, // TODO: requires knowing the token address on l2 (if its available on l2)
    wellOracleSnapshots,
    twaReserves,
    usdTokenPrice,
    sops,
    fields,
    convertCapacity,
    oracleImplementation,
    shipmentRoutes,
    // bytes32[16] _buffer_1;
    casesV2,
    silo,
    fert,
    season,
    weather,
    seedGauge,
    rain,
    migration,
    seedGaugeSettings,
    sop
  };
}

async function siloStruct() {
  console.log('Gathering silo info...');
}

async function fieldStruct() {
  console.log('Gathering field info...');
  const [pods, harvested, harvestable] = await Promise.all([
    bs.s.f.pods,
    bs.s.f.harvested,
    bs.s.f.harvestable
  ]);
  return {
    pods,
    harvested,
    harvestable
    // bytes32[8] _buffer;
  }
}

async function fertilizerStruct() {
  console.log('Gathering fertilizer info...');
  const [
    activeFertilizer,
    fertilizedIndex,
    unfertilizedIndex,
    fertFirst,
    fertLast,
    bpf,
    recapitalized
  ] = await Promise.all([
    getActualActiveFertilizer(bs),
    getActualFertilizedIndex(bs),
    getActualUnfertilizedIndex(bs),
    bs.s.fFirst,
    bs.s.fLast,
    bs.s.bpf,
    bs.s.recapitalized
  ]);

  const fertilizer = {};
  const nextFid = {};
  let current = fertFirst;
  while (current != BigInt(0)) {
    const [amount, next] = await Promise.all([bs.s.fertilizer[current], bs.s.nextFid[current]]);
    fertilizer[current] = amount;
    if (next !== BigInt(0)) {
      nextFid[current] = next;
    }
    current = next;
  }

  return {
    fertilizer,
    nextFid,
    activeFertilizer,
    fertilizedIndex,
    unfertilizedIndex,
    fertilizedPaidIndex: BigInt(getClaimedFert(BLOCK)),
    fertFirst,
    fertLast,
    bpf,
    recapitalized,
    // Amount of beans shipped to fert but unpaid due to not being proportional to active fert. previously untracked
    leftoverBeans: 0n
    // bytes32[8] _buffer;
  }
}

async function seasonStruct() {
  console.log('Gathering season info...');
  const [
    current,
    lastSop,
    withdrawSeasons,
    lastSopSeason,
    rainStart,
    raining,
    fertilizing,
    sunriseBlock,
    abovePeg,
    stemStartSeason,
    stemScaleSeason,
    start,
    period,
    timestamp
  ] = await Promise.all([
    bs.s.season.current,
    bs.s.season.lastSop,
    bs.s.season.withdrawSeasons,
    bs.s.season.lastSopSeason,
    bs.s.season.rainStart,
    bs.s.season.raining,
    bs.s.season.fertilizing,
    bs.s.season.sunriseBlock,
    bs.s.season.abovePeg,
    bs.s.season.stemStartSeason,
    bs.s.season.stemScaleSeason,
    bs.s.season.start,
    bs.s.season.period,
    bs.s.season.timestamp,
  ]);
  return {
    current,
    lastSop,
    withdrawSeasons,
    lastSopSeason,
    rainStart,
    raining,
    fertilizing,
    sunriseBlock,
    abovePeg,
    stemStartSeason,
    stemScaleSeason,
    start,
    period,
    timestamp
    // bytes32[8] _buffer;
  }
}

async function weatherStruct() {
  console.log('Gathering weather info...');
  const [
    lastDeltaSoil,
    lastSowTime,
    thisSowTime,
    temp
  ] = await Promise.all([
    bs.s.w.lastDSoil,
    bs.s.w.lastSowTime,
    bs.s.w.thisSowTime,
    bs.s.w.t
  ]);
  return {
    lastDeltaSoil,
    lastSowTime,
    thisSowTime,
    temp
    // bytes32[8] _buffer;
  }
}

async function seedGaugeStruct() {
  console.log('Gathering gauge info...');
  const [
    averageGrownStalkPerBdvPerSeason,
    beanToMaxLpGpPerBdvRatio
  ] = await Promise.all([
    bs.s.seedGauge.averageGrownStalkPerBdvPerSeason,
    bs.s.seedGauge.beanToMaxLpGpPerBdvRatio
  ]);
  return {
    averageGrownStalkPerBdvPerSeason,
    beanToMaxLpGpPerBdvRatio
    // bytes32[8] _buffer;
  }
}

async function rainStruct() {
  console.log('Gathering rain info...');
  const [
    pods,
    roots
  ] = await Promise.all([
    bs.s.r.pods,
    bs.s.r.roots
  ]);
  return {
    pods,
    roots
    // bytes32[8] _buffer;
  }
}

async function assetSiloStruct(token) {
  console.log('Gathering asset silo info (${token})...');
  const [
    deposited,
    depositedBdv
  ] = await Promise.all([
    bs.s.siloBalances[token].deposited,
    bs.s.siloBalances[token].depositedBdv
    // TODO: what to do with withdrawn? These corresponding assets should be put into user internal balances
    // bs.s.siloBalances[token].withdrawn
  ]);
  return {
    deposited,
    depositedBdv
  }
}

async function whitelistStatusStructs() {
  console.log('Gathering whitelist info...');
  const whitelistStatuses = [];
  // 6 whitelisted tokens
  for (let i = 0; i < 6; ++i) {
    const [
      token,
      isWhitelisted,
      isWhitelistedLp,
      isWhitelistedWell
    ] = await Promise.all([
      bs.s.whitelistStatuses[i].token,
      bs.s.whitelistStatuses[i].isWhitelisted,
      bs.s.whitelistStatuses[i].isWhitelistedLp,
      bs.s.whitelistStatuses[i].isWhitelistedWell
    ]);
    whitelistStatuses.push({
      token,
      isWhitelisted,
      isWhitelistedLp,
      isWhitelistedWell,
      isSoppable: tokenEq(token, BEANWETH) // TODO: how to determine which one is soppable?
    })
  }
}

async function assetSettingsStruct() {

}

async function unripeSettingsStruct() {

}

async function twaReservesStruct(pool) {
  const [reserve0, reserve1] = await Promise.all([
    bs.s.twaReserves[BEANWETH].reserve0,
    bs.s.twaReserves[BEANWETH].reserve1
  ]);
  return {
    reserve0,
    reserve1
  };
}

async function depositedStruct() {

}

async function convertCapacityStruct() {

}

async function germinatingSiloStruct() {

}

async function shipmentRouteStruct() {

}

async function migrationStruct() {

}

async function implementationStruct() {

}

async function seedGaugeSettingsStruct() {

}

async function seasonOfPlentyStruct() {

}

const GerminationSideEnum = {
  'ODD': 0,
  'EVEN': 1,
  'NOT_GERMINATING': 2
}

const ShipmentRecipientEnum = {
  'NULL': 0,
  'SILO': 1,
  'FIELD': 2,
  'BARN': 3
};

module.exports = {
  systemStruct
}
