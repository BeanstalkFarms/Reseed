const { QueryParameter, DuneClient } = require("@duneanalytics/client-sdk");
const { providerThenable } = require("./provider");

async function getDuneResult(queryId, block) {
  const client = new DuneClient(process.env.DUNE_API_KEY);
  const opts = {
    queryId,
    query_parameters: await makeParameters(queryId, block)
  };
  return await client.runQuery(opts);
}

async function makeParameters(queryId, block) {
  if (queryId === 3798359) {
    const provider = await providerThenable;
    const blockData = await provider.getBlock(block);
    return [
      QueryParameter.date("snapshot", formatDate(new Date(blockData.timestamp * 1000)))
    ];
  } else {
    return [
      QueryParameter.number("block", block)
    ];
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

module.exports = {
  getDuneResult
};
