const fs = require('fs');

function fertilizerStorageBalances(block) {

  const fertData = JSON.parse(fs.readFileSync(`results/fert${block}.json`));
  const lastBpf = BigInt(fertData.totals.bpf);

  const _balances = Object.keys(fertData.accounts).reduce((result, account) => {
    for (const fertId in fertData.accounts[account]) {
      if (!result[fertId]) {
        result[fertId] = {};
      }
      result[fertId][account] = {
        amount: BigInt(fertData.accounts[account][fertId].amount),
        // All accounts get the same lastBpf since their sprouts were claimed
        lastBpf
      }
    }
    return result;
  }, {});

  return {
    _balances
  };
}

module.exports = {
  fertilizerStorageBalances
}
