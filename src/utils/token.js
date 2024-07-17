const { BEANSTALK, BEAN, BEANWETH, BEANWSTETH, BEAN3CRV, UNRIPE_BEAN, UNRIPE_LP } = require('../contracts/addresses.js');

const L2_TOKEN_MAPPING = { // TODO: once contracts deployed on l2
  [BEAN]: '0x1111111111111111111111111111111111111111',
  [BEANWETH]: '0x2222222222222222222222222222222222222222',
  [BEANWSTETH]: '0x3333333333333333333333333333333333333333',
  [UNRIPE_BEAN]: '0x4444444444444444444444444444444444444444',
  [UNRIPE_LP]: '0x5555555555555555555555555555555555555555',
  [BEAN3CRV] : '0x6666666666666666666666666666666666666666'
}

function l2Token(l1Token) {
  return L2_TOKEN_MAPPING[l1Token];
}

function tokenEq(t1, t2) {
  return t1.toLowerCase() === t2.toLowerCase();
}

module.exports = {
  l2Token,
  tokenEq
}
