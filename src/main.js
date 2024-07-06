const { exportFert } = require("./barn");
const { exportPlots } = require("./field");
const { exportMarket } = require("./market");
const { exportDeposits } = require("./silo");

// Entrypoint for when running individually
(async () => {

  const args = process.argv.slice(2);
  
  if (args.length != 2) {
    throw new Error("Required args not provided. Please provide a block number")
  }

  const block = parseInt(args[1]);
  switch (args[0]) {
    case 'all':
      // Shouldn't use Promise.all here since each is already optimized for rate limits
      await exportDeposits(block);
      await exportPlots(block);
      await exportFert(block);
      await exportMarket(block);
      break;
    case 'silo':
      await exportDeposits(block);
      break;
    case 'field':
      await exportPlots(block);
      break;
    case 'barn':
      await exportFert(block);
      break;
    case 'market':
      await exportMarket(block);
      break;
  }

})()

async function silo() {
  
}

async function field() {
  
}

async function barn() {

}