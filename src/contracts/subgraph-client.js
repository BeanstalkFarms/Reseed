const { GraphQLClient, gql } = require('graphql-request');

const SUBGRAPH_BEANSTALK = 'https://graph.node.bean.money/subgraphs/name/beanstalk';
const SUBGRAPH_BEAN = 'https://graph.node.bean.money/subgraphs/name/bean';

const clients = {};

function getClient(url) {
  if (!clients[url]) {
    clients[url] = new GraphQLClient(url);
  }
  return clients[url];
}

function clientBuilder(url) {
  return async (query) => {
    const client = getClient(url);
    return await client.request(query);
  };
}

module.exports = {
  beanstalkSG: clientBuilder(SUBGRAPH_BEANSTALK),
  beanSG: clientBuilder(SUBGRAPH_BEAN),
  builder: clientBuilder,
  gql: gql
};
