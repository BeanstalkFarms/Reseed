const { exportFert } = require("./barn");
const { exportPlots } = require("./field");

// Entrypoint for when running individually
(async () => {

  const args = process.argv.slice(2);
  
  if (args.length != 2) {
    throw new Error("Required args not provided. Please provide a block number")
  }

  const block = parseInt(args[1]);
  switch (args[0]) {
    case 'all':
      break;
    case 'silo':
      break;
    case 'field':
      exportPlots(block);
      break;
    case 'barn':
      exportFert(block);
      break;
    case 'market':
      break;
  }

})()

async function silo() {
  
}

async function field() {
  
}

async function barn() {

}