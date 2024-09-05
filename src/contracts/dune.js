const { QueryParameter, DuneClient } = require("@duneanalytics/client-sdk");

async function getDuneResult(queryId, block) {
  const client = new DuneClient(process.env.DUNE_API_KEY);
  const opts = {
    queryId,
    query_parameters: [
      QueryParameter.number("block", block)
    ],
  };
  return await client.runQuery(opts);
}

module.exports = {
  getDuneResult
};
