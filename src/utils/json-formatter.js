function absBigInt(x) {
  return x < 0 ? -x : x;
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

module.exports = {
  bigintHex,
  bigintDecimal
}
