const contracts = {
  BEANSTALK: '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5',
  BEANSTALK_PRICE: '0xb01CE0008CaD90104651d6A84b6B11e182a9B62A',
  BEAN: ['0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab', 6],
  BEAN3CRV: ['0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49', 18],
  BEANWETH: ['0xbea0e11282e2bb5893bece110cf199501e872bad', 18],
  UNRIPE_BEAN: ['0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449', 6],
  UNRIPE_LP: ['0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d', 6],
  FERTILIZER: '0x402c84De2Ce49aF88f5e2eF3710ff89bFED36cB6',
  CRV3: ['0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490', 18],
  BEAN3CRV_V1: ['0x3a70dfa7d2262988064a2d051dd47521e43c9bdd', 18],
  BEANLUSD: ['0xd652c40fbb3f06d6b58cb9aa9cff063ee63d465d', 18],
  LUSD_3POOL: ['0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA', 18],
  LUSD: ['0x5f98805A4E8be255a32880FDeC7F6728C6568bA0', 18],
  THREEPOOL: ['0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', 18],
  BEANETH_UNIV2: ['0x87898263B6C5BABe34b4ec53F22d98430b91e371', 18],
  WETHUSCD_UNIV2: ['0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc', 18],
  USDC: ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6],
  WETH: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18],
  TETHER: ['0xdAC17F958D2ee523a2206206994597C13D831ec7', 6],
  DAI: ['0x6B175474E89094C44Da98b954EedeAC495271d0F', 18],
  PEPE: ['0x6982508145454Ce325dDbE47a25d4ec3d2311933', 18],
  CALCULATIONS_CURVE: '0x25BF7b72815476Dd515044F9650Bf79bAd0Df655',
  MULTI_FLOW_PUMP: '0xBA510f10E3095B83a0F33aa9ad2544E22570a87C'
};

const addressesOnly = Object.fromEntries(
  Object.entries(contracts).map(
    ([k, v]) => [k, Array.isArray(v) ? v[0] : v]
  )
);

const tokenDecimals = Object.fromEntries(
  Object.entries(contracts).filter(
    ([k, v]) => Array.isArray(v)
  ).map(
    ([k, v]) => [v[0], v[1]]
  )
);

module.exports = {
  ...addressesOnly,
  DECIMALS: tokenDecimals
};
