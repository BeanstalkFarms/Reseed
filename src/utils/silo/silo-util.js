const fs = require('fs');
const { tokenEq } = require("../token");
const { BEAN, BEANWETH, BEANWSTETH, BEAN3CRV, UNRIPE_BEAN, UNRIPE_LP } = require('../../contracts/addresses.js');

const AMOUNT_TO_BDV_BEAN_ETH = BigInt(119894802186829);
const AMOUNT_TO_BDV_BEAN_3CRV = BigInt(992035);
const AMOUNT_TO_BDV_BEAN_LUSD = BigInt(983108);
const UNRIPE_CURVE_BEAN_METAPOOL = '0x3a70DfA7d2262988064A2D051dd47521E43c9BdD';
const UNRIPE_CURVE_BEAN_LUSD_POOL = '0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D';

// Equivalent to LibBytes.packAddressAndStem
function packAddressAndStem(address, stem) {
  const addressBigInt = BigInt(address);
  const stemBigInt = BigInt(stem);
  return (addressBigInt << BigInt(96)) | (stemBigInt & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFF'));
}

// Equivalent to LibLegacyTokenSilo.seasonToStem
function seasonToStem(season, stemStartSeason, seedsPerBdv) {
  return (BigInt(season) - stemStartSeason) * (seedsPerBdv * BigInt(10 ** 6));
}

// Equivalent to LibLegacyTokenSilo.getLegacySeedsPerToken
function getLegacySeedsPerToken(token) {
  if (tokenEq(token, BEAN)) {
    return 2n;
  } else if (tokenEq(token, UNRIPE_BEAN)) {
    return 2n;
  } else if (tokenEq(token, UNRIPE_LP)) {
    return 4n;
  } else if (tokenEq(token, BEAN3CRV)) {
    return 4n;
  }
  return 0n;
}

async function getBeanEthUnripeLP(account, season, bs) {
  return {
    amount: (await bs.s.a[account].lp.deposits[season]) * AMOUNT_TO_BDV_BEAN_ETH / BigInt(10 ** 18),
    bdv: (await bs.s.a[account].lp.depositSeeds[season]) / BigInt(4)
  }
}

async function getBean3CrvUnripeLP(account, season, bs) {
  return {
    amount: (await bs.s.a[account].legacyV2Deposits[UNRIPE_CURVE_BEAN_METAPOOL][season].amount) * AMOUNT_TO_BDV_BEAN_3CRV / BigInt(10 ** 18),
    bdv: await bs.s.a[account].legacyV2Deposits[UNRIPE_CURVE_BEAN_METAPOOL][season].bdv
  }
}

async function getBeanLusdUnripeLP(account, season, bs) {
  return {
    amount: (await bs.s.a[account].legacyV2Deposits[UNRIPE_CURVE_BEAN_LUSD_POOL][season].amount) * AMOUNT_TO_BDV_BEAN_LUSD / BigInt(10 ** 18),
    bdv: await bs.s.a[account].legacyV2Deposits[UNRIPE_CURVE_BEAN_LUSD_POOL][season].bdv
  }
}

// Returns a sum of user stalk and deposited token amounts, to be used as system-level values
function getSumOfUserTotals(block) {
  const accountStorage = JSON.parse(fs.readFileSync(`results/storage-accounts${block}.json`));
  const siloBalances = {};
  let allStalk = 0n;
  for (const account in accountStorage) {
    for (const token in accountStorage[account].depositIdList) {
      if (!siloBalances[token]) {
        siloBalances[token] = {
          amount: 0n,
          bdv: 0n
        }
      }
      for (let depositId of accountStorage[account].depositIdList[token]) {
        depositId = BigInt(depositId);
        siloBalances[token].amount += BigInt(accountStorage[account].deposits[depositId].amount);
        siloBalances[token].bdv += BigInt(accountStorage[account].deposits[depositId].bdv);
      }
    }
    allStalk += BigInt(accountStorage[account].stalk);
  }
  return {
    stalkMinusGerminating: allStalk,
    tokens: siloBalances
  }
}

// Scale stalk up to 16 decimals total
function getL2StalkAmount(l1Amount) {
  return l1Amount * BigInt(10 ** 6);
}

module.exports = {
  packAddressAndStem,
  seasonToStem,
  getLegacySeedsPerToken,
  getBeanEthUnripeLP,
  getBean3CrvUnripeLP,
  getBeanLusdUnripeLP,
  getSumOfUserTotals,
  WHITELISTED: [BEAN, BEANWETH, BEANWSTETH, BEAN3CRV, UNRIPE_BEAN, UNRIPE_LP],
  WHITELISTED_LP: [BEANWETH, BEAN3CRV, BEANWSTETH],
  getL2StalkAmount
}
