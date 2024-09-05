const fs = require('fs');
const { UNRIPE_BEAN, UNRIPE_LP } = require('./contracts/addresses.js');

function stalkAnalysis(block) {
  const deposits = JSON.parse(fs.readFileSync(`results/deposits${block}.json`));
  let sumUnripeStalk = 0n;
  let sumUnripeBaseStalk = 0n
  let sumAllStalk = 0n;
  for (const account in deposits.accounts) {
    for (const token in deposits.accounts[account]) {
      if (token != "totals") {
        for (const stem in deposits.accounts[account][token]) {
          const stalk = BigInt(deposits.accounts[account][token][stem].stalk);
          if ([UNRIPE_BEAN, UNRIPE_LP].includes(token)) {
            sumUnripeStalk += stalk;
            sumUnripeBaseStalk += BigInt(deposits.accounts[account][token][stem].bdv) * BigInt(10 ** 4);
          }
          sumAllStalk += stalk;
        }
      }
    }
  }
  const sumUnripeGrownStalk = sumUnripeStalk - sumUnripeBaseStalk;

  console.log(`Unripe stalk:      ${sumUnripeStalk}`);
  console.log(`All stalk:         ${sumAllStalk}`);
  console.log(`Ratio:             ${Number(sumUnripeStalk) / Number(sumAllStalk)}`);
  console.log(`Unripe base stalk: ${sumUnripeBaseStalk}`);
  console.log(`Would-be ratio:    ${Number(sumUnripeBaseStalk) / Number(sumAllStalk - sumUnripeGrownStalk)}`);
}
// stalkAnalysis(20536034);

function replantMerkleAnalysis() {
  const beanMerkle = JSON.parse(fs.readFileSync(`inputs/unripe-beans-merkle.json`));
  const sumMerkleBeans = Object.keys(beanMerkle).reduce((a, next) => a + BigInt(beanMerkle[next].amount), 0n);

  const beanData = fs.readFileSync(`inputs/unripe-beans.csv`, 'utf8').split('\n');
  const sumDataBeans = beanData.reduce((a, next) => a + BigInt(next.split(',')[1]), 0n);

  console.log(`Sum of merkle file beans:       ${sumMerkleBeans}`);
  console.log(`Sum of merkle input data beans: ${sumDataBeans}`);
  console.log(`Difference?                     ${sumMerkleBeans - sumDataBeans}`);

  const lpMerkle = JSON.parse(fs.readFileSync(`inputs/unripe-lp-merkle.json`));
  const sumMerkleLp = Object.keys(lpMerkle).reduce((a, next) => a + BigInt(lpMerkle[next].amount), 0n);

  const lpData = fs.readFileSync(`inputs/unripe-lp.csv`, 'utf8').split('\n');
  const sumDataLp = lpData.reduce((a, next) => a + BigInt(next.split(',')[1]), 0n);

  console.log(`Sum of merkle file lp:          ${sumMerkleLp}`);
  console.log(`Sum of merkle input data lp:    ${sumDataLp}`);
  console.log(`Difference?                     ${sumMerkleLp - sumDataLp}`);
}
replantMerkleAnalysis();