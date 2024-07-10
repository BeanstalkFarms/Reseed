# Reseed
Storage migration for L2

# Instructions
Generate the required exports from Dune and place in the `inputs` directory. These filenames should be appended with the block number that was used to generate the export. Then, run `npm run all <block>` with the same block number used in the Dune export.

Silo: Dune query https://dune.com/queries/3849370
Silo Withdrawn: Dune query https://dune.com/queries/3906871
Field: Plots will be automatically pulled from the subgraph and cached locally
Barn: Dune query (must login as beanstalkfarmsteam) https://dune.com/queries/3899244
Market: Listings/Orders automatically pulled from subgraph and cached locally
Internal balances (by account): https://dune.com/queries/3907145