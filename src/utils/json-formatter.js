const ethers = require('ethers');

function absBigInt(x) {
  return x < 0 ? -x : x;
}

function maxBigInt(...args) {
  return args.reduce((max, current) => current > max ? current : max);
}

const bigintHex = (_, value) => {
  if (typeof value === 'bigint') {
    const abs = absBigInt(value);
    return `${abs === value ? '' : '-'}0x${abs.toString(16)}`
  } else {
    return value;
  }
}

const bigintDecimal = (_, value) => {
  return typeof value === 'bigint' ? value.toString(10) : value;
}

// Replaces all addresses with the checksum version
const addressChecksum = (str) => {
  return str.replace(/"0x[a-f0-9]{40}"/g, (match) => `"${ethers.getAddress(match.substring(1, 43))}"`);
}

module.exports = {
  absBigInt,
  maxBigInt,
  bigintHex,
  bigintDecimal,
  addressChecksum
}
