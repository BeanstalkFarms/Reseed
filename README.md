# Reseed

Storage migration for L2

# Instructions

Run `npm run all <block>` to run the entirety of the scripts for the given block. A subset of scripts can be run as well, see main.js for available options.

All of the below query results are pulled using `DUNE_API_KEY`.

Silo: Dune query https://dune.com/queries/3849370
Silo Withdrawn: Dune query https://dune.com/queries/3906871
Field: Plots will be automatically pulled from the subgraph and cached locally
Barn: Dune query (must login as beanstalkfarmsteam) https://dune.com/queries/3899244
Market: Listings/Orders automatically pulled from subgraph and cached locally
Internal balances (by account): https://dune.com/queries/3907145
