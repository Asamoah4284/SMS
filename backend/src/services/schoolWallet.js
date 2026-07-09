const WALLET_ID = 'default';

async function getOrCreateWallet(tx) {
  const client = tx || require('../config/db');
  let wallet = await client.schoolWallet.findUnique({ where: { id: WALLET_ID } });
  if (!wallet) {
    wallet = await client.schoolWallet.create({ data: { id: WALLET_ID } });
  }
  return wallet;
}

async function creditSchoolWallet(tx, amountGhs) {
  if (amountGhs <= 0) return;
  await getOrCreateWallet(tx);
  await tx.schoolWallet.update({
    where: { id: WALLET_ID },
    data: { availableBalanceGhs: { increment: amountGhs } },
  });
}

async function debitSchoolWallet(tx, amountGhs) {
  const wallet = await getOrCreateWallet(tx);
  if (wallet.availableBalanceGhs + 0.004 < amountGhs) {
    throw new Error('INSUFFICIENT_BALANCE');
  }
  await tx.schoolWallet.update({
    where: { id: WALLET_ID },
    data: { availableBalanceGhs: { decrement: amountGhs } },
  });
}

async function getWalletBalance() {
  const wallet = await getOrCreateWallet();
  return wallet.availableBalanceGhs;
}

module.exports = {
  getOrCreateWallet,
  creditSchoolWallet,
  debitSchoolWallet,
  getWalletBalance,
};
