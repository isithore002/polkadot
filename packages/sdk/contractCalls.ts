import { ethers } from "ethers";

export const PVMARK_ABI = [
  "function hashLeaf(bytes calldata data) external pure returns (bytes32)",
  "function hashPair(bytes32 left, bytes32 right) external pure returns (bytes32)",
  "function verifyProof(bytes32 leaf, bytes32[] calldata proof, bytes32 root) external pure returns (bool)",
  "function storageWrite(bytes32 key, bytes32 value) external",
  "function storageRead(bytes32 key) external view returns (bytes32)",
  "function fibonacci(uint256 n) external returns (uint256)",
];

export function getPVMarkContract(
  address: string,
  signerOrProvider: ethers.Signer | ethers.Provider
): ethers.Contract {
  return new ethers.Contract(address, PVMARK_ABI, signerOrProvider);
}

export function hashValue(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}
