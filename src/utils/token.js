const { BEAN, BEANWETH, BEANWSTETH, BEAN3CRV, UNRIPE_BEAN, UNRIPE_LP } = require('../contracts/addresses.js');

const L2_TOKEN_MAPPING = {
  [BEAN]: '0xBEA0005B8599265D41256905A9B3073D397812E4',
  [BEANWETH]: '0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce',
  [BEANWSTETH]: '0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F',
  [UNRIPE_BEAN]: '0x1BEA054dddBca12889e07B3E076f511Bf1d27543',
  [UNRIPE_LP]: '0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788',
  [BEAN3CRV]: '0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7'
};

function l2Token(l1Token) {
  return L2_TOKEN_MAPPING[l1Token];
}

function tokenEq(t1, t2) {
  return t1.toLowerCase() === t2.toLowerCase();
}

module.exports = {
  l2Token,
  tokenEq
};
