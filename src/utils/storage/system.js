const fs = require('fs');
const { plentySeasons } = require('../../../inputs/plenty-seasons.js');
const { BEANSTALK, BEAN, BEANWETH, BEAN3CRV, UNRIPE_BEAN, UNRIPE_LP } = require('../../contracts/addresses.js');
const { getActualActiveFertilizer, getActualFertilizedIndex, getActualUnfertilizedIndex, getClaimedSprouts } = require('../barn/barn-util.js');
const { tokenEq } = require('../token.js');
const { createAsyncERC20ContractGetter } = require('../../contracts/contract.js');
const { runBatchPromises } = require('../batch-promise.js');
const { WHITELISTED } = require('../silo/silo-util.js');

let BLOCK;
let bs;

async function systemStruct(options) {

  console.log('Gathering system info...');

  BLOCK = options.block;
  bs = options.bs;

  const [
    paused,
    pausedAt,
    soil,
    beanSown,
    beanWethSnapshot,
    beanWethTwaReserves,
    casesV2
  ] = await Promise.all([
    bs.s.paused,
    bs.s.pausedAt,
    bs.s.f.soil,
    bs.s.f.beanSown,
    bs.s.wellOracleSnapshots[BEANWETH],
    twaReservesStruct(BEANWETH),
    bs.s.deprecated2// bs.s.casesV2 TODO: using shorter array because its faster for testing
  ]);

  const { podListings, podOrders } = getMarketMappings();
  const internalTokenBalanceTotal = getInternalBalanceMapping();

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
  const sops = {};
  // const sops = (await Promise.all(
  //   plentySeasons.map(async s => ([
  //     [s], await bs.s.sops[s]
  //   ]))
  // )).reduce((a, next) => {
  //   a[next[0]] = next[1]
  //   return a;
  // }, {});

  // I dont think these are necessary on migration ?
  const convertCapacity = {};
  const oracleImplementation = {};
  const shipmentRoutes = [];
  const sop = {};

  const [
    silo,
    field0,
    fert,
    season,
    weather,
    seedGauge,
    rain,
    migration,
    seedGaugeSettings
  ] = await Promise.all([
    siloStruct(),
    fieldStruct(),
    fertilizerStruct(),
    seasonStruct(),
    weatherStruct(),
    seedGaugeStruct(),
    rainStruct(),
    migrationStruct(),
    seedGaugeSettingsStruct()
  ]);

  const fields = {
    0: field0
  };

  return {
    paused: BigInt(paused),
    pausedAt,
    reentrantStatus: 0n, // ?
    isFarm: 0n, // ?
    ownerCandidate: null, // address?
    plenty: 0n, // ?
    soil,
    beanSown,
    activeField: 0n,
    fieldCount: 1n,
    // bytes32[16] _buffer_0,
    podListings,
    podOrders,
    internalTokenBalanceTotal,
    wellOracleSnapshots,
    twaReserves,
    usdTokenPrice,
    sops,
    fields,
    convertCapacity,
    oracleImplementation,
    shipmentRoutes,
    // bytes32[16] _buffer_1,
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

function getMarketMappings() {
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
  return {
    podListings,
    podOrders
  };
}

function getInternalBalanceMapping() {
  const balancesFile = JSON.parse(fs.readFileSync(`results/internal-balances${BLOCK}.json`));
  const internalBalances = {};
  for (const token in balancesFile.totals) {
    internalBalances[token] = BigInt(balancesFile.totals[token].l2total);
  }
  return internalBalances;
}

async function siloStruct() {
  console.log('Gathering silo info...');
  const [
    stalk,
    roots,
    earnedBeans
  ] = await Promise.all([
    bs.s.s.stalk,
    bs.s.s.roots,
    bs.s.earnedBeans
  ]);
  const balances = {};
  const assetSilos = await Promise.all(WHITELISTED.map(assetSiloStruct));
  for (let i = 0; i < assetSilos.length; ++i) {
    balances[WHITELISTED[i]] = assetSilos[i];
  }

  const assetSettings = {};
  const settingsStructs = await Promise.all(WHITELISTED.map(assetSettingsStruct));
  for (let i = 0; i < settingsStructs.length; ++i) {
    assetSettings[WHITELISTED[i]] = settingsStructs[i];
  }

  const [
    unripeSettings,
    whitelistStatuses,
    germinating,
    unclaimedGerminating
  ] = await Promise.all([
    unripeSettingsStructs(),
    whitelistStatusStructs(),
    germinatingMapping(),
    unclaimedGerminatingMapping()
  ]);

  return {
    stalk,
    roots,
    earnedBeans,
    balances,
    assetSettings,
    unripeSettings,
    whitelistStatuses,
    germinating,
    unclaimedGerminating
    // bytes32[8] _buffer
  }
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
    // bytes32[8] _buffer
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
    fertilizedPaidIndex: getClaimedSprouts(BLOCK),
    fertFirst,
    fertLast,
    bpf,
    recapitalized,
    // Amount of beans shipped to fert but unpaid due to not being proportional to active fert. previously untracked
    leftoverBeans: 0n
    // bytes32[8] _buffer
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
    // bytes32[8] _buffer
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
    // bytes32[8] _buffer
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
    // bytes32[8] _buffer
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
    // bytes32[8] _buffer
  }
}

async function assetSiloStruct(token) {
  const [
    deposited,
    depositedBdv
  ] = await Promise.all([
    bs.s.siloBalances[token].deposited, // TODO: l2 token scaling
    bs.s.siloBalances[token].depositedBdv
  ]);
  return {
    deposited,
    depositedBdv
  }
}

async function whitelistStatusStructs() {
  const whitelistStatuses = [];
  for (let i = 0; i < WHITELISTED.length; ++i) {
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
  return whitelistStatuses;
}

async function assetSettingsStruct(token) {
  const [
    selector,
    stalkEarnedPerSeason,
    stalkIssuedPerBdv,
    milestoneSeason,
    milestoneStem,
    encodeType,
    deltaStalkEarnedPerSeason,
    gaugePoints,
    optimalPercentDepositedBdv
  ] = await Promise.all([
    bs.s.ss[token].selector,
    bs.s.ss[token].stalkEarnedPerSeason,
    bs.s.ss[token].stalkIssuedPerBdv,
    bs.s.ss[token].milestoneSeason,
    bs.s.ss[token].milestoneStem,
    bs.s.ss[token].encodeType,
    bs.s.ss[token].deltaStalkEarnedPerSeason,
    bs.s.ss[token].gaugePoints,
    bs.s.ss[token].optimalPercentDepositedBdv
  ]);
  return {
    selector,
    stalkEarnedPerSeason,
    stalkIssuedPerBdv,
    milestoneSeason,
    milestoneStem,
    encodeType,
    deltaStalkEarnedPerSeason,
    gaugePoints,
    optimalPercentDepositedBdv,
    gaugePointImplementation: null,
    liquidityWeightImplementation: null,
    oracleImplementation: null
  }
}

async function unripeSettingsStructs() {
  const [
    urbeanUnderlyingToken,
    urbeanBalanceOfUnderlying,
    urlpUnderlyingToken,
    urlpBalanceOfUnderlying
  ] = await Promise.all([
    bs.s.u[UNRIPE_BEAN].underlyingToken,
    bs.s.u[UNRIPE_BEAN].balanceOfUnderlying,
    bs.s.u[UNRIPE_LP].underlyingToken,
    bs.s.u[UNRIPE_LP].balanceOfUnderlying
  ]);
  return {
    [UNRIPE_BEAN]: {
      underlyingToken: urbeanUnderlyingToken,
      balanceOfUnderlying: urbeanBalanceOfUnderlying
    },
    [UNRIPE_LP]: {
      underlyingToken: urlpUnderlyingToken,
      balanceOfUnderlying: urlpBalanceOfUnderlying
    }
  };
}

async function twaReservesStruct(pool) {
  const [reserve0, reserve1] = await Promise.all([
    bs.s.twaReserves[pool].reserve0,
    bs.s.twaReserves[pool].reserve1
  ]);
  return {
    reserve0,
    reserve1
  };
}

async function germinatingMapping() {
  const oddResults = await Promise.all(WHITELISTED.map(async (token) => ({
    token,
    amount: await bs.s.oddGerminating.deposited[token].amount,
    bdv: await bs.s.oddGerminating.deposited[token].bdv,
  })));
  const evenResults = await Promise.all(WHITELISTED.map(async (token) => ({
    token,
    amount: await bs.s.evenGerminating.deposited[token].amount,
    bdv: await bs.s.evenGerminating.deposited[token].bdv,
  })));
  const reducer = (a, next) => {
    a[next.token] = {
      amount: next.amount, // TODO: need to do token amount scaling here also
      bdv: next.bdv
    };
    return a;
  };
  return {
    0: oddResults.reduce(reducer, {}),
    1: evenResults.reduce(reducer, {}),
  }
}

async function unclaimedGerminatingMapping() {
  // Enumerate all seasons since seedgauge deployment and save those which have unclaimed germinating
  const startSeason = 21797;
  const currentSeason = Number(await bs.s.season.current);

  const unclaimedGerminating = {};
  const promiseGenerators = [];
  for (let i = startSeason; i <= currentSeason; ++i) {
    promiseGenerators.push(async () => {
      const [stalk, roots] = await Promise.all([bs.s.unclaimedGerminating[i].stalk, bs.s.unclaimedGerminating[i].roots]);
      if (stalk !== 0n) {
        unclaimedGerminating[i] = {
          stalk,
          roots
        };
      }
    });
  }

  await runBatchPromises(promiseGenerators, 50);
  return unclaimedGerminating;
}

async function migrationStruct() {
  // Set this according to total supply minus beanstalk/beaneth/bean3crv/beanwsteth
  const beanToken = await createAsyncERC20ContractGetter(BEAN)();
  const totalSupply = BigInt(await beanToken.callStatic.totalSupply({blockTag: BLOCK}));
  const beanstalkBalance = BigInt(await beanToken.callStatic.balanceOf(BEANSTALK, {blockTag: BLOCK}));
  const beanethBalance = BigInt(await beanToken.callStatic.balanceOf(BEANWETH, {blockTag: BLOCK}));
  const bean3crvBalance = BigInt(await beanToken.callStatic.balanceOf(BEAN3CRV, {blockTag: BLOCK}));
  // const beanwstethBalance = BigInt(await beanToken.callStatic.balanceOf(BEANWETH, {blockTag: BLOCK}));

  // TODO: BEANwstETH
  return {
    migratedL1Beans: totalSupply - beanstalkBalance - beanethBalance - bean3crvBalance /*- beanwstethBalance*/,
    // bytes32[4] _buffer_
  };
}

async function seedGaugeSettingsStruct() {
  // TODO: these should be set to something
  return {
    maxBeanMaxLpGpPerBdvRatio: 0n,
    minBeanMaxLpGpPerBdvRatio: 0n,
    targetSeasonsToCatchUp: 0n,
    podRateLowerBound: 0n,
    podRateOptimal: 0n,
    podRateUpperBound: 0n,
    deltaPodDemandLowerBound: 0n,
    deltaPodDemandUpperBound: 0n,
    lpToSupplyRatioUpperBound: 0n,
    lpToSupplyRatioOptimal: 0n,
    lpToSupplyRatioLowerBound: 0n,
    excessivePriceThreshold: 0n
  }
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
