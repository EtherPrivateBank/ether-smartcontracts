// scripts/generateWallets.js

const { ethers } = require("hardhat");

async function generateWallets(numberOfWallets) {
  const wallets = [];
  for (let i = 0; i < numberOfWallets; i++) {
    const wallet = ethers.Wallet.createRandom();
    wallets.push(wallet);
    console.log(`Wallet ${i+1}: Address=${wallet.address} PrivateKey=${wallet.privateKey}`);
  }
  return wallets;
}

const numberOfWallets = parseInt(process.argv[2], 10) || 6;

generateWallets(numberOfWallets).then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});