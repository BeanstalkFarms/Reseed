const { exportFert } = require("./barn");
const { exportMigratedTokens } = require("./migrated-tokens");
const { exportContracts } = require("./contract-addresses");
const { exportPlots } = require("./field");
const { exportInternalBalances } = require("./internal-balance");
const { exportMarket } = require("./market");
const { exportDeposits } = require("./silo");
const { exportStorage } = require("./storage");
const { runVerification } = require("./verify");

// Main entrypoint for all scripts
(async () => {

  const args = process.argv.slice(2);
  
  if (args.length != 2) {
    throw new Error("Required args not provided. Please provide a block number")
  }

  const block = parseInt(args[1]);
  switch (args[0]) {
    case 'all':
      // Shouldn't use Promise.all here since each is already optimized for rate limits (and some depend on previous)
      await exportDeposits(block);
      await exportPlots(block);
      await exportFert(block);
      await exportMarket(block);
      await exportInternalBalances(block);
      await exportMigratedTokens(block);
      await exportContracts(block);
      await exportStorage(block);
      await runVerification(block);
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
    case 'balances':
      await exportInternalBalances(block);
      break;
    case 'tokens':
      await exportMigratedTokens(block);
      break;
    case 'contracts':
      await exportContracts(block);
      break;
    case 'storage':
      await exportStorage(block);
      break;
    case 'verify':
      await runVerification(block);
      break;
  }

})()
