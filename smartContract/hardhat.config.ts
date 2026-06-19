import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
 networks: {
    hoodi: {
      url:  process.env.HOODI_RPC_URL || "https://rpc.hoodi.ethpandaops.io",
      chainId: 560048,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "http://127.0.0.1:8545",
      chainId: 84532,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
etherscan: {
  apiKey: process.env.ETHERSCAN_API_KEY,
  customChains: [
    {
      network: "hoodi",
      chainId: 560048,
      urls: {
        apiURL: "https://explorer.hoodi.ethpandaops.io/api",
        browserURL: "https://explorer.hoodi.ethpandaops.io"
      }
    },
    {
      network: "baseSepolia",
      chainId: 84532,
      urls: {
        apiURL: "https://sepolia.base.org",
        browserURL: "https://sepolia.basescan.org"
      }
    }
  ]
}
};

export default config;
