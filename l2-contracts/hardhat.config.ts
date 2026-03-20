import "@matterlabs/hardhat-zksync-verify";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-typechain";
import "@matterlabs/hardhat-zksync";

// If no network is specified, use the default config
if (!process.env.CHAIN_ETH_NETWORK) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config();
}

export default {
  zksolc: {
    version: "1.5.13",
    compilerSource: "binary",
    settings: {
      enableEraVMExtensions: false,
      optimizer: {
        enabled: true,
        mode: "z",
        fallback_to_optimizing_for_size: true,
      },
    },
  },
  solidity: {
    compilers: [{ version: "0.5.16" }, { version: "0.6.6" }, { version: "0.8.24" }],
  },
  defaultNetwork: "localhost",
  networks: {
    localhost: {
      // era-test-node default url
      url: "http://127.0.0.1:8011",
      ethNetwork: "localhost",
      zksync: true,
    },
    viaTestnet: {
      // Via testnet (chainId 25223)
      url: process.env.VIA_TESTNET_RPC_URL || "https://via.testnet.viablockchain.dev",
      ethNetwork: process.env.VIA_TESTNET_ETH_NETWORK || "sepolia",
      zksync: true,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : undefined,
      verifyURL:
        process.env.VIA_TESTNET_VERIFY_URL ||
        "https://testnet.blockscout.onvia.org/api/",
    },
    zkSyncTestnet: {
      url: "https://zksync2-testnet.zksync.dev",
      ethNetwork: "goerli",
      zksync: true,
      // contract verification endpoint
      verifyURL: "https://zksync2-testnet-explorer.zksync.dev/contract_verification",
    },
    zkSyncTestnetSepolia: {
      url: "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia",
      zksync: true,
      // contract verification endpoint
      verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
    },
    zkSyncMainnet: {
      url: "https://mainnet.era.zksync.io",
      ethNetwork: "mainnet",
      zksync: true,
      // contract verification endpoint
      verifyURL: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
    },
  },
};
