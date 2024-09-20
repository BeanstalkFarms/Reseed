const fs = require('fs');
const { getDuneResult } = require("./contracts/dune");
const { providerThenable } = require("./contracts/provider");
const { runBatchPromises } = require("./utils/batch-promise");

const BATCH_SIZE = 100;
let BLOCK;

let checkProgress = 0;

// An address is considered to be a contract if it has associated code
async function isContract(address) {
  const provider = await providerThenable;
  try {
    return await provider.getCode(address) !== "0x";
  } catch (e) {
    return false;
  }
}

async function identifyContracts(addresses) {
  const promiseGenerators = [];
  const results = []
  for (const account of addresses) {
    promiseGenerators.push(async () => {
      if (await isContract(account)) {
        results.push(account);
      }
      process.stdout.write(`\r${++checkProgress}`);
    });
  }
  await runBatchPromises(promiseGenerators, BATCH_SIZE);
  results.sort();
  return results;
}

async function getCurrentHolders() {
  const duneResult = await getDuneResult(3798359, BLOCK);
  return duneResult.result.rows.map(r => r.account);
}

async function exportContracts(block) {

  BLOCK = block;

  console.log(`Identifying accounts that are contracts...`);
  const allHolders = await getCurrentHolders();

  const total = allHolders.length;
  console.log(`Processing ${total} accounts...`);
  process.stdout.write(`\r0${' '.repeat((total).toString().length - 1)} / ${total}`);
  const contracts = await identifyContracts(allHolders);

  const outFile = `results/contract-accounts${block}.json`;
  await fs.promises.writeFile(outFile, JSON.stringify(contracts, null, 2));
  console.log(`\rWrote contract accounts to ${outFile}`);
}

module.exports = {
  exportContracts
};
