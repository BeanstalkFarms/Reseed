const { exportFert } = require("./barn");

// Entrypoint for when running individually
(async () => {

  const args = process.argv.slice(2);
  
  if (args.length != 2) {
    throw new Error("Required args not provided. Please provide a block number")
  }

  switch (args[0]) {
    case 'all':
      break;
    case 'silo':
      break;
    case 'field':
      break;
    case 'barn':
      exportFert(parseInt(args[1]));
      break;
  }

})()

async function silo() {
  
}

async function field() {
  
}

async function barn() {

}