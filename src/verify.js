const fs = require('fs');
const { BEANSTALK, BEAN, BEANWSTETH, UNRIPE_BEAN, UNRIPE_LP } = require('./contracts/addresses.js');
const { createAsyncERC20ContractGetter, asyncBeanstalkContractGetter } = require("./contracts/contract");
const { tokenEq } = require('./utils/token.js');
const { getRinsableSprouts } = require('./utils/barn/barn-util.js');
const storageLayout = require('./contracts/abi/storageLayout.json');
const ContractStorage = require('@beanstalk/contract-storage');
const { providerThenable } = require('./contracts/provider.js');
const { getHarvestablePods } = require('./utils/field/field-util.js');
const { getAmountInOrders } = require('./utils/market/market-util.js');
const { maxBigInt } = require('./utils/json-formatter.js');

let BLOCK;
let beanstalk;
let bs;

async function checkContractTokens() {

  // Get total deposited amount of each token
  const totalDeposited = {};
  const sumInternal = {};
  const sumUnpicked = {};
  const allDeposits = JSON.parse(fs.readFileSync(`results/deposits${BLOCK}.json`));
  for (const account in allDeposits.accounts) {
    for (const token in allDeposits.accounts[account].totals) {
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
      totalDeposited[token].amount += BigInt(allDeposits.accounts[account].totals[token].amount);
      totalDeposited[token].bdv += BigInt(allDeposits.accounts[account].totals[token].bdv);
    }
  }

  // Get internal balance amounts
  const internalBalances = JSON.parse(fs.readFileSync(`results/internal-balances${BLOCK}.json`));
  for (const token in internalBalances.totals) {
    sumInternal[token] = BigInt(internalBalances.totals[token].currentInternal);
    sumUnpicked[token] = BigInt(internalBalances.totals[token].unpicked);
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
      const harvestable = getHarvestablePods(BLOCK);
      const rinsable = getRinsableSprouts(BLOCK);
      const podOrders = getAmountInOrders(BLOCK);
      console.log(`Sum of Harvestable Pods:    ${harvestable}`);
      console.log(`Sum of Unclaimed Sprouts:   ${rinsable}`);
      console.log(`Sum of Pod order beans:     ${podOrders}`);
      difference -= harvestable;
      difference -= rinsable;
      difference -= podOrders;
    }
    if ([UNRIPE_BEAN, UNRIPE_LP].includes(token)) {
      console.log(`Sum of Unpicked:            ${sumUnpicked[token]}`);
      difference -= sumUnpicked[token];
    }
    if ([BEAN, BEANWSTETH].includes(token)) {
      const underlying = BigInt(await beanstalk.callStatic.getTotalUnderlying(token === BEAN ? UNRIPE_BEAN : UNRIPE_LP, { blockTag: BLOCK }));
      console.log(`Sum of Ripe underlying:     ${underlying}`)
      difference -= underlying
    }
    console.log(`Net Difference:             ${difference}`);
  }
}

function checkSystemVsAccounts() {
  const systemStorage = JSON.parse(fs.readFileSync(`results/storage-system${BLOCK}.json`));
  const accountStorage = JSON.parse(fs.readFileSync(`results/storage-accounts${BLOCK}.json`));
  const fertStorage = JSON.parse(fs.readFileSync(`results/storage-fertilizer${BLOCK}.json`));

  const internalTokenBalanceTotal = {};
  let fieldEnd = 0n;
  const siloBalances = {};
  const fertilizerTotals = {};
  for (const account in accountStorage) {
    // internalTokenBalanceTotal
    for (const token in accountStorage[account].internalTokenBalance) {
      if (!internalTokenBalanceTotal[token]) {
        internalTokenBalanceTotal[token] = 0n;
      }
      internalTokenBalanceTotal[token] += BigInt(accountStorage[account].internalTokenBalance[token]);
    }
    // fields
    const maxPlotEnd = Object.keys(accountStorage[account].fields[0].plots).reduce((a, next) => {
      const index = BigInt(next);
      const length = BigInt(accountStorage[account].fields[0].plots[next]);
      const end = index + length;
      return maxBigInt(a, end);
    }, 0n);
    fieldEnd = maxBigInt(fieldEnd, maxPlotEnd);
    // silo
    for (const token in accountStorage[account].depositIdList) {
      if (!siloBalances[token]) {
        siloBalances[token] = {
          amount: 0n,
          bdv: 0n
        }
      }
      for (let depositId of accountStorage[account].depositIdList[token]) {
        depositId = BigInt(depositId);
        siloBalances[token].amount += BigInt(accountStorage[account].deposits[depositId].amount);
        siloBalances[token].bdv += BigInt(accountStorage[account].deposits[depositId].bdv);
      }
    }
  }

  // fertilizer
  for (const fertId in fertStorage._balances) {
    fertilizerTotals[fertId] = Object.keys(fertStorage._balances[fertId]).reduce((a, next) => {
      return a + BigInt(fertStorage._balances[fertId][next].amount);
    }, 0n);
  }

  const check = (v1, v2, message) => {
    if (v1 !== v2) {
      console.log(message);
      console.log(v1.toString(10));
      console.log(v2.toString(10));
      console.log((v1 - v2).toString(10));
      console.log();
    }
  }

  // Compare against system values
  for (const token in systemStorage.internalTokenBalanceTotal) {
    check(BigInt(systemStorage.internalTokenBalanceTotal[token]), (internalTokenBalanceTotal[token] ?? 0n), `[WARNING]: Internal balance sum mismatch for ${token}`);
  }

  check(fieldEnd, BigInt(systemStorage.fields[0].pods), '[WARNING]: Field pod line length mismatch');

  for (const token in systemStorage.silo.balances) {
    if (BigInt(systemStorage.silo.balances[token].deposited) !== (siloBalances[token]?.amount ?? 0n)) {
      check(BigInt(systemStorage.silo.balances[token].deposited), (siloBalances[token]?.amount ?? 0n), `[WARNING]: Silo deposited amount mismatch for ${token}`);
    }
    if (BigInt(systemStorage.silo.balances[token].depositedBdv) !== (siloBalances[token]?.bdv ?? 0n)) {
      check(BigInt(systemStorage.silo.balances[token].depositedBdv), (siloBalances[token]?.bdv ?? 0n), `[WARNING]: Silo deposited bdv mismatch for ${token}`);
    }
  }

  // Expecting a difference of 147 for id 6m, see barn-util.js
  for (const fertId in systemStorage.fert.fertilizer) {
    if (BigInt(systemStorage.fert.fertilizer[fertId]) !== fertilizerTotals[fertId]) {
      if (fertId !== '6000000' || BigInt(systemStorage.fert.fertilizer[fertId]) - fertilizerTotals[fertId] !== 147n) {
        console.log(`[WARNING]: Fertilizer amount mismatch for ${fertId}`);
      }
    }
  }
}

async function runVerification(block) {

  BLOCK = block;
  beanstalk = await asyncBeanstalkContractGetter();
  bs = new ContractStorage(await providerThenable, BEANSTALK, storageLayout, BLOCK);

  checkSystemVsAccounts();
  await checkContractTokens();
}

module.exports = {
  runVerification
};
