import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

export const NETWORKS: Record<string, { name: string; rpcUrl: string; chainId: number }> = {
  westendAssetHub: {
    name: "Westend Asset Hub",
    rpcUrl: process.env.WESTEND_RPC || "https://westend-asset-hub-eth-rpc.polkadot.io",
    chainId: 420420421,
  },
  local: {
    name: "Local Hardhat",
    rpcUrl: "http://127.0.0.1:8545",
    chainId: 31337,
  },
};

export function getProvider(network: string = "westendAssetHub"): ethers.JsonRpcProvider {
  const config = NETWORKS[network];
  if (!config) throw new Error("Unknown network: " + network);
  return new ethers.JsonRpcProvider(config.rpcUrl, { name: config.name, chainId: config.chainId });
}

export function getWallet(network: string = "westendAssetHub"): ethers.Wallet {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not set in .env");
  return new ethers.Wallet(pk, getProvider(network));
}
