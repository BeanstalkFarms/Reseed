const fs = require('fs');
const { BEANSTALK } = require('./contracts/addresses.js');
const storageLayout = require('./contracts/abi/storageLayout.json');
const { providerThenable } = require('./contracts/provider');
const ContractStorage = require('@beanstalk/contract-storage');
const { allPaginatedSG } = require('./utils/subgraph-paginate.js');
const { beanstalkSG } = require('./contracts/subgraph-client.js');
const { bigintDecimal } = require('./utils/json-formatter.js');

const BATCH_SIZE = 100;
let BLOCK;

let checkProgress = 0;

let sumHarvested = BigInt(0);
let sumUnharvested = BigInt(0);

const unharvestedHarvestable = [];

let amountInBalances = BigInt(0);
let balances = {};

// Gets all plots from the subgraph, or a local cache if this was previously retrieved for the same block.
async function getAllPlots() {
  
  let allPlots;
  const plotCache = `inputs/cached-field-plots${BLOCK}.json`;
  if (fs.existsSync(plotCache)) {
    allPlots = JSON.parse(fs.readFileSync(plotCache));
    console.log(`Loaded ${allPlots.length} cached plots`);
  } else {
    console.log(`No cached plots, querying subgraph...`);

    allPlots = await getPlotsFromSubgraph();
    console.log(`Found ${allPlots.length} plots`);

    await fs.promises.writeFile(plotCache, JSON.stringify(allPlots, null, 2));
    console.log(`Wrote plots to ${plotCache}`);
  }
  return allPlots;
}

// Retrieve all plots from the subgraph
async function getPlotsFromSubgraph() {

  return await allPaginatedSG(
    beanstalkSG,
    `
      {
        plots {
          id
          index
          pods
          harvestedPods
          harvestablePods
          farmer {
            id
          }
        }
      }
    `,
    `block: {number: ${BLOCK}}`,
    '',
    ['index'],
    [0],
    'asc'
  );
}

async function checkPlot(plot) {
  const account = plot.farmer.id;
  if (plot.harvestedPods == '0') {
    const contractPlotAmount = await bs.s.a[account].field.plots[plot.index];
    if (BigInt(plot.pods) != contractPlotAmount) {
      console.log(`[WARNING]: Plot at index ${plot.index} for farmer ${account} was not ${plot.pods}! (was ${contractPlotAmount})`);
    }
    if (plot.harvestablePods != '0') {
      sumUnharvested += BigInt(plot.harvestablePods);
      unharvestedHarvestable.push(plot);
    }
    if (!balances[account]) {
      balances[account] = {};
    }
    balances[account][plot.index] = {
      amount: contractPlotAmount
    };
    amountInBalances += contractPlotAmount;
  } else {
    sumHarvested += BigInt(plot.harvestedPods);
  }
  
  process.stdout.write(`\r${++checkProgress}`);
}

async function exportPlots(block) {

  BLOCK = block;
  bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);

  let allPlots = await getAllPlots();

  // Sum the total amount of pods
  let totalPods = BigInt(0);
  for (const plot of allPlots) {
    totalPods += BigInt(plot.pods);
  }

  const contractPods = await bs.s.f.pods;
  if (contractPods !== totalPods) {
    console.log(`[WARNING]: Pod amount mismatch detected: ${totalPods} | ${contractPods}`);
  }

  // Check that each account owns each plot/amount
  const allPromiseGenerators = allPlots.map((plot) => () => checkPlot(plot));
  process.stdout.write(`\r0${' '.repeat(allPlots.length.toString().length - 1)} / ${allPlots.length}`);
  while (allPromiseGenerators.length > 0) {
    await Promise.all(allPromiseGenerators.splice(0, Math.min(BATCH_SIZE, allPromiseGenerators.length)).map(p => p()));
  }

  console.log(`\rChecked ${checkProgress} assets`);
  
  if (amountInBalances + sumHarvested != await bs.s.f.pods) {
    console.log(`[WARNING]: Sum of user balances did not equal total unharvested pods!`);
  }

  const outFile = `results/pods${BLOCK}.json`;
  const harvestableFile = `results/pods-harvestable${BLOCK}.json`;
  await fs.promises.writeFile(outFile, JSON.stringify(balances, bigintDecimal, 2));
  await fs.promises.writeFile(harvestableFile, JSON.stringify(unharvestedHarvestable, bigintDecimal, 2));

  console.log(`Pod balances exported to ${outFile}`);

}

module.exports = {
  exportPlots
};
