const fs = require('fs');
const { BEANSTALK, BEAN, BEANWETH, UNRIPE_BEAN, UNRIPE_LP } = require('./contracts/addresses.js');
const { createAsyncERC20ContractGetter, asyncBeanstalkContractGetter } = require("./contracts/contract");
const { tokenEq } = require('./utils/token.js');
const { getRinsableSprouts } = require('./utils/barn/barn-util.js');
const storageLayout = require('./contracts/abi/storageLayout.json');
const ContractStorage = require('@beanstalk/contract-storage');
const { providerThenable } = require('./contracts/provider.js');

let BLOCK;
let beanstalk;
let bs;

async function checkDepositedAmounts() {

  // Get total deposited amount of each token
  const totalDeposited = {};
  const sumInternal = {};
  const allDeposits = JSON.parse(fs.readFileSync(`results/deposits${BLOCK}.json`));
  for (const account in allDeposits) {
    for (const token in allDeposits[account].totals) {
      if (!token.startsWith("0x")) {
        continue;
      }
      if (!totalDeposited[token]) {
        totalDeposited[token] = {
          amount: 0n,
          bdv: 0n
        };
        sumInternal[token] = 0n;
      }
      totalDeposited[token].amount += BigInt(allDeposits[account].totals[token].amount);
      totalDeposited[token].bdv += BigInt(allDeposits[account].totals[token].bdv);
    }
  }

  // Get internal balance amounts
  const internalBalances = fs.readFileSync(`inputs/internal-totals${BLOCK}.csv`, 'utf8');
  const entries = internalBalances.split('\n').slice(1);
  for (const row of entries) {
    const elem = row.split(',');
    if (totalDeposited[elem[0]]) {
      sumInternal[elem[0]] = BigInt(elem[1]);
    }
  }

  // Compare against total amount of tokens in the contract
  for (const token in totalDeposited) {
    const contract = await createAsyncERC20ContractGetter(token)();
    const beanstalkBalance = BigInt(await contract.balanceOf(BEANSTALK, { blockTag: BLOCK }));
    const withdrawn = await bs.s.siloBalances[token].withdrawn;
    let difference = beanstalkBalance - totalDeposited[token].amount - sumInternal[token] - withdrawn;
    console.log('-------------------------------------------------------------')
    console.log(`Token: ${token}`);
    console.log(`Beanstalk Contract Balance: ${beanstalkBalance}`);
    console.log(`Sum of Deposited:           ${totalDeposited[token].amount}`);
    console.log(`Sum of Withdrawn:           ${withdrawn}`);
    console.log(`Sum of Internal Balances:   ${sumInternal[token]}`);
    if (tokenEq(token, BEAN)) {
      const rinsable = getRinsableSprouts(BLOCK);
      console.log(`Sum of Unclaimed Sprouts:   ${rinsable}`);
      difference -= rinsable;
    }
    if ([BEAN, BEANWETH].includes(token)) {
      const underlying = BigInt(await beanstalk.callStatic.getTotalUnderlying(token === BEAN ? UNRIPE_BEAN : UNRIPE_LP, { blockTag: BLOCK }));
      console.log(`Sum of Ripe underlying:     ${underlying}`)
      difference -= underlying
    }
    console.log(`Net Difference:             ${difference}`);
  }
}

(async () => {

  const args = process.argv.slice(2);
  
  if (args.length != 1) {
    throw new Error("Required args not provided. Please provide a block number")
  }

  BLOCK = parseInt(args[0]);
  beanstalk = await asyncBeanstalkContractGetter();
  bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);

  await checkDepositedAmounts();

})()
