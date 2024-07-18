const fs = require('fs');
const ethers = require('ethers');
const { BEANSTALK } = require('./contracts/addresses.js');
const storageLayout = require('./contracts/abi/storageLayout.json');
const { providerThenable } = require('./contracts/provider');
const ContractStorage = require('@beanstalk/contract-storage');
const { allPaginatedSG } = require('./utils/subgraph-paginate.js');
const { beanstalkSG } = require('./contracts/subgraph-client.js');
const { bigintHex } = require('./utils/json-formatter.js');
const { runBatchPromises } = require('./utils/batch-promise.js');

const BATCH_SIZE = 100;
let BLOCK;

// The id encoding is different on each
const marketStorage = {
  listings: {
    beanstalk2: {},
    beanstalk3: {}
  },
  orders: {
    beanstalk2: {},
    beanstalk3: {}
  }
};

let checkProgress = 0;

// Gets all market items from the subgraph, or a local cache if this was previously retrieved for the same block.
async function getAllMarket() {
  
  let allMarket;
  const marketCache = `inputs/cached-market${BLOCK}.json`;
  if (fs.existsSync(marketCache)) {
    allMarket = JSON.parse(fs.readFileSync(marketCache));
    console.log(`Loaded ${allMarket.listings.length} listings and ${allMarket.orders.length} orders (cached)`);
  } else {
    console.log(`No cached listings/orders, querying subgraph...`);

    allMarket = await getMarketFromSubgraph();
    console.log(`Found ${allMarket.listings.length} listings and ${allMarket.orders.length} orders`);

    await fs.promises.writeFile(marketCache, JSON.stringify(allMarket, null, 2));
    console.log(`Wrote listings/orders to ${marketCache}`);
  }
  return allMarket;
}

// Retrieve minimal info from the subgraph needed to assign listings/orders
// For listings: retrieving just the index is sufficient.
// For orders: retrieving just the id is sufficient.
// From the above we can get the id/amount of beans still in the order.
async function getMarketFromSubgraph() {

  const listings = await allPaginatedSG(
    beanstalkSG,
    `
      {
        podListings {
          id
          farmer {
            id
          }
          index
          start
          amount
          pricePerPod
          maxHarvestableIndex
          minFillAmount
          mode
        }
      }
    `,
    `block: {number: ${BLOCK}}`,
    'status_in: [ACTIVE]', // FILLED_PARTIAL is on the filled orders which had their ends truncated
    ['index'],
    [0],
    'asc'
  );

  const orders = await allPaginatedSG(
    beanstalkSG,
    `
      {
        podOrders {
          id
          farmer {
            id
          }
          pricePerPod
          maxPlaceInLine
          minFillAmount
        }
      }
    `,
    `block: {number: ${BLOCK}}`,
    'status_in: [ACTIVE]',
    ['id'],
    [0],
    'asc'
  );

  return {
    listings,
    orders
  };
}

// mapping(uint256 => bytes32) podListings;
async function checkListing(listing) {
  const listingHash = await bs.s.podListings[listing.index];
  if (BigInt(listingHash) === BigInt(0)) {
    console.log(`[WARNING]: A pod listing for index ${listing.index} was not found!`);
  }
  marketStorage.listings.beanstalk2[listing.index] = listingHash;
  marketStorage.listings.beanstalk3[listing.index] = hashListing(listing);

  process.stdout.write(`\r${++checkProgress}`);
}

// mapping(bytes32 => uint256) podOrders;
async function checkOrder(order) {
  const originalOrderId = order.id.replace(/-\d+$/, '');
  const orderAmount = await bs.s.podOrders[originalOrderId];
  if (orderAmount === BigInt(0)) {
    console.log(`[WARNING]: A pod order for id ${originalOrderId} was not found!`);
  }
  marketStorage.orders.beanstalk2[originalOrderId] = orderAmount;
  marketStorage.orders.beanstalk3[hashOrder(order)] = orderAmount;

  process.stdout.write(`\r${++checkProgress}`);
}

// Same as Listing.sol::_hashListing()
function hashListing(listing) {
  return ethers.keccak256(ethers.solidityPacked(
    ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint24', 'uint256', 'uint256', 'uint8'],
    [listing.farmer.id, 0, listing.index, listing.start, listing.amount, listing.pricePerPod, listing.maxHarvestableIndex, listing.minFillAmount, listing.mode]
  ));

  // Pre-migration format. Not needed but kept here for reference.
  // if (listing.minFillAmount > 0) {
  //   return ethers.keccak256(ethers.solidityPacked(
  //     ['uint256', 'uint256', 'uint24', 'uint256', 'uint256', 'bool'],
  //     [listing.start, listing.amount, listing.pricePerPod, listing.maxHarvestableIndex, listing.minFillAmount, listing.mode === 0]
  //   ));
  // } else {
  //   return ethers.keccak256(ethers.solidityPacked(
  //     ['uint256', 'uint256', 'uint24', 'uint256', 'bool'],
  //     [listing.start, listing.amount, listing.pricePerPod, listing.maxHarvestableIndex, listing.mode === 0]
  //   ));
  // }
}

// Same as Order.sol::_getOrderId()
function hashOrder(order) {
  return ethers.keccak256(ethers.solidityPacked(
    ['address', 'uint256', 'uint24', 'uint256', 'uint256'],
    [order.farmer.id, 0, order.pricePerPod, order.maxPlaceInLine, order.minFillAmount]
  ));

  // Pre-migration format. Not needed but kept here for reference.
  // if (order.minFillAmount > 0) {
  //   return ethers.keccak256(ethers.solidityPacked(
  //     ['address', 'uint24', 'uint256', 'uint256'],
  //     [order.farmer.id, order.pricePerPod, order.maxPlaceInLine, order.minFillAmount]
  //   ));
  // } else {
  //   return ethers.keccak256(ethers.solidityPacked(
  //     ['address', 'uint24', 'uint256'],
  //     [order.farmer.id, order.pricePerPod, order.maxPlaceInLine]
  //   ));
  // }
}

// NOTE: it is not possible to verify with certainty that ALL pod listings/orders are encapsulated here.
// However, the impact of missing one of these is highly negligible
async function exportMarket(block) {

  BLOCK = block;
  bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);

  const allMarket = await getAllMarket();

  // Check that each listing/order exists and what the hash or bean amount is
  const allPromiseGenerators = [
    ...allMarket.listings.map((listing) => () => checkListing(listing)),
    ...allMarket.orders.map((order) => () => checkOrder(order))
  ]

  const total = allMarket.listings.length + allMarket.orders.length;
  process.stdout.write(`\r0${' '.repeat((total).toString().length - 1)} / ${total}`);
  await runBatchPromises(allPromiseGenerators, BATCH_SIZE);

  console.log(`\rChecked ${checkProgress} listings/orders`);

  const outFile = `results/market${BLOCK}.json`;
  await fs.promises.writeFile(outFile, JSON.stringify(marketStorage, bigintHex, 2));

  console.log(`Marketplace data exported to ${outFile}`);

}

module.exports = {
  exportMarket
}
