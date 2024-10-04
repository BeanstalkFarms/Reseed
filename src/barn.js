const fs = require('fs');
const readline = require('readline');
const { BEANSTALK } = require('./contracts/addresses.js');
const { asyncFertContractGetter } = require('./contracts/contract.js');
const { bigintDecimal } = require('./utils/json-formatter.js');
const retryable = require('./utils/retryable.js');
const storageLayout = require('./contracts/abi/storageLayout.json');
const ContractStorage = require('@beanstalk/contract-storage');
const { providerThenable } = require('./contracts/provider.js');
const { getActualFertilizedIndex } = require('./utils/barn/barn-util.js');
const { getDuneResult } = require('./contracts/dune.js');

const BATCH_SIZE = 100;
let BLOCK;

let checkProgress = 0;

let fert;
let sumFertEvent = BigInt(0);
let sumFertContract = BigInt(0);
let sumRinsable = BigInt(0);
let sumUnrinsable = BigInt(0);

let balances = {};

async function checkBalance(row) {
  const [account, eventAmount, humidity, id] = [row.account, row.amount, row.humidity, row.id];

  const [contractAmount, rinsableSprouts, unrinsableSprouts] = await Promise.all([
    retryable(() => fert.callStatic.balanceOf(account, id, { blockTag: BLOCK })).then(BigInt),
    retryable(() => fert.callStatic.balanceOfFertilized(account, [id], { blockTag: BLOCK })).then(BigInt),
    retryable(() => fert.callStatic.balanceOfUnfertilized(account, [id], { blockTag: BLOCK })).then(BigInt)
  ]);

  if (BigInt(eventAmount) != BigInt(contractAmount)) {
    console.log(`[WARNING]: Balance of id ${id} for farmer ${account} was not ${eventAmount}! (was ${contractAmount})`);
  }
  sumFertEvent += BigInt(eventAmount);
  sumFertContract += BigInt(contractAmount);
  sumRinsable += rinsableSprouts;
  sumUnrinsable += unrinsableSprouts;

  if (!balances[account]) {
    balances[account] = {};
  }
  balances[account][id] = {
    amount: contractAmount,
    rinsableSprouts,
    unrinsableSprouts,
    humidity
  };

  process.stdout.write(`\r${++checkProgress} / ?`);
}

async function exportFert(block) {
  BLOCK = block;
  fert = await asyncFertContractGetter();
  bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);

  console.log('Checking Fert balances...');

  const duneResult = await getDuneResult(3899244, BLOCK);

  let rowBuffer = [];
  for await (const row of duneResult.result.rows) {
    rowBuffer.push(row);
    if (rowBuffer.length >= BATCH_SIZE) {
      await Promise.all(rowBuffer.map(checkBalance));
      rowBuffer = [];
    }
  }
  if (rowBuffer.length > 0) {
    await Promise.all(rowBuffer.map(checkBalance));
  }

  console.log(`\rChecked ${checkProgress} assets`);
  if (sumFertEvent !== sumFertContract) {
    console.log(`[WARNING]: Fertilizer amount mismatch detected: ${sumFertEvent} | ${sumFertContract}`);
  }

  const results = {
    accounts: balances,
    totals: {
      sumClaimed: (await getActualFertilizedIndex(bs)) - sumRinsable,
      sumRinsable,
      sumUnrinsable,
      bpf: await bs.s.bpf
    }
  };

  const outFile = `results/fert${BLOCK}.json`;
  await fs.promises.writeFile(outFile, JSON.stringify(results, bigintDecimal, 2));
  console.log(`Fertilizer balances exported to ${outFile}`);
}

module.exports = {
  exportFert
};
