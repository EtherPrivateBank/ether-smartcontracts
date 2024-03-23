# eReais: A Stablecoin by Ether Private Bank

## Overview

eReais is a premier digital stablecoin that mirrors the Brazilian Real, brought to you by **Ether Private Bank**, the pioneering crypto bank specializing in diverse cryptocurrencies and stablecoin operations. Operating on the Ethereum blockchain, eReais leverages ERC20 standards for seamless integration with the vast Ethereum ecosystem.

## Key Features

- **ERC20 Compliance**: Ensures broad compatibility across wallets and decentralized applications (dApps).
- **Dynamic Supply Management**: Authorized roles have the capability to mint or burn tokens.
- **Operational Control**: Designated officials can pause and unpause the contract, offering operational flexibility in response to external conditions.
- **Role-Based Access Control**: Implements sophisticated access control for roles such as Admin, Minter, Burner, Compliance Officer, and Pauser.
- **Regulatory Compliance and Security**: Features a blacklisting function to manage compliance and enhance security.

## Roles Explained

- **Admin**: Oversees governance and role management.
- **Minter**: Authorized for token minting.
- **Burner**: Can burn tokens to adjust supply.
- **Compliance Officer**: Manages address blacklisting for compliance.
- **Pauser**: Controls the pausing and unpausing of the contract.

### Contract Address on Polygon Mumbai Testnet

You can interact with the eReais contract on the Polygon Mumbai Testnet at the following address:

[0xFa6460313b4CBbBBE4C431d687E8bE9b42fbB71a](https://mumbai.polygonscan.com/address/0xFa6460313b4CBbBBE4C431d687E8bE9b42fbB71a)

# Deployment Instructions

To deploy the eReais contract to the Polygon Mumbai testnet, execute the following command in your terminal:

```bash
npx hardhat run scripts/deploy.js --network polygonMumbai
```

This command will deploy the eReais contract to the specified network.

## Verification on PolygonScan

Once the contract is deployed, you can verify it on PolygonScan for transparency and public verification. Use the following command to submit your contract's source code and constructor arguments to PolygonScan:

```bash
npx hardhat verify --network polygonMumbai 0xFa6460313b4CBbBBE4C431d687E8bE9b42fbB71a "0x0Bb7024355A398D94539b86aB36E71645B59d025" "0x25BF4e09814DaF3A915c493a4A36867181089561" "0x72241421aA4Dab753298989c26b53E3e682c566F" "0xe01d2d7447Bb83CDEd0Adc7362752218F8F5479f" "0x0dD35E84e01A4326dB29F5546f3050145E32b4f5" "0x9316597a2d0057b16453354A596EecDDB9728a0a"
```

Make sure to replace the constructor parameters in the command above with the actual values you used during the contract deployment.

After executing the command, you will receive a link to your contract's page on PolygonScan where you can see the verification status and interact with your contract's code and ABI.

## Security and Compliance

At Ether Private Bank, we prioritize the security and regulatory compliance of our offerings. eReais incorporates **HSM technology from Dinamo**, ensuring top-tier security for cryptographic operations and key management. This state-of-the-art technology underscores our commitment to providing a secure and compliant environment for our digital assets.

## Deployment Details

eReais is meticulously deployed, with each role assigned to specific, secure wallets, ensuring decentralized governance and enhanced security.

## About Ether Private Bank

**Ether Private Bank** stands at the forefront of the crypto banking sector, offering a wide range of services including the management and operation of cryptocurrencies and stablecoins. Our commitment to innovation, security, and compliance positions us as a leader in the digital finance landscape.

## Security Contact

For any security concerns or inquiries, please reach out to our dedicated security team at security@etherprivatebank.com.br.

## About us

The introduction of eReais marks a significant milestone in blending traditional financial stability with the flexibility and potential of blockchain technology. Ether Private Bank is excited to offer this stable, secure, and compliant digital currency to our clients, paving the way for broader adoption and integration of blockchain solutions in financial services.
