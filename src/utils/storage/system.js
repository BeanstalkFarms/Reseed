let BLOCK;
let beanstalk;
let bs;

async function systemStruct(options) {

  BLOCK = options.block;
  beanstalk = options.beanstalk;
  bs = options.bs;

  const [soil, beansSown, casesV2] = await Promise.all([
    bs.s.f.soil,
    bs.s.f.beansSown,
    bs.s.casesV2
  ]);

  const [
    silo,
    field,
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

  return {
    paused: false,
    pausedAt: 0,
    reentrantStatus: 0, // ?
    isFarm: 0, // ?
    ownerCandidate: null, // address?
    plenty: 0, // ?
    soil,
    beansSown,
    activeField: 0,
    fieldCount: 1,
    // bytes32[16] _buffer_0;
    podListings,
    podOrders,
    internalTokenBalanceTotal,
    wellOracleSnapshots,
    twaReserves,
    usdTokenPrice: {}, // ?
    sops,
    fields,
    convertCapacity,
    oracleImplementation,
    shipmentRoutes,
    // bytes32[16] _buffer_1;
    casesV2,
    silo,
    field,
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

}

async function fieldStruct() {

}

async function fertilizerStruct() {

}

async function seasonStruct() {

}

async function weatherStruct() {

}

async function seedGaugeStruct() {

}

async function rainStruct() {

}

async function assetSiloStruct() {

}

async function whitelistStatusStruct() {

}

async function assetSettingsStruct() {

}

async function unripeSettingsStruct() {

}

async function twaReservesStruct() {

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
