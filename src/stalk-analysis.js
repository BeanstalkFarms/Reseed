const fs = require('fs');
const { UNRIPE_BEAN, UNRIPE_LP } = require('./contracts/addresses.js');

function analysis(block) {
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
analysis(20536034);
