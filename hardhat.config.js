// hardhat.config.js
require("@nomicfoundation/hardhat-foundry");
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ignition-ethers");
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();
require("@nomicfoundation/hardhat-verify");

const PRIVATE_KEY = vars.get("PRIVATE_KEY");
const POLYGON_RPC_URL = vars.get("POLYGON_RPC_URL");
const POLYGONSCAN_API_KEY = vars.get("POLYGONSCAN_API_KEY");
const ETHERPRIVATEBANK_RPC_URL = vars.get("ETHERPRIVATEBANK_RPC_URL");
const PRIVATE_KEY_ETHER = vars.get("PRIVATE_KEY_ETHER");
const ETHERPRIVATEBANK_CHAIN_ID = parseInt(vars.get("ETHERPRIVATEBANK_CHAIN_ID"), 10);

module.exports = {
  networks: {
    hardhat: {
    },
    polygonMumbai: {
      url: POLYGON_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 80001,
    },
    etherPrivateBank: {
      url: ETHERPRIVATEBANK_RPC_URL,
      accounts: [PRIVATE_KEY_ETHER],
      gasPrice: 0,
      chainId: 188,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
      {
        version: "0.4.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    ignition: "./ignition"
  },
  mocha: {
    timeout: 40000
  },
  etherscan: {
    apiKey: {
      polygonMumbai: POLYGONSCAN_API_KEY,
    },
  },
  sourcify: {
    enabled: true,
  },
};
