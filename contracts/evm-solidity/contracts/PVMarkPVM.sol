// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PVMarkPVM
 * @dev This version is designed to be compiled by resolc into PolkaVM bytecode.
 * It contains the core logic that we want to benchmark on the PVM engine.
 */
contract PVMarkPVM {
    /**
     * @dev Optimized Keccak-256 hashing for a leaf node.
     * This represents the "native" PVM implementation (fallback version).
     */
    function hashLeaf(bytes32 leaf) external pure returns (bytes32) {
        return keccak256(abi.encode(leaf));
    }

    /**
     * @dev Optimized Keccak-256 hashing for a pair of nodes.
     */
    function hashPair(bytes32 left, bytes32 right) external pure returns (bytes32) {
        if (left < right) {
            return keccak256(abi.encodePacked(left, right));
        } else {
            return keccak256(abi.encodePacked(right, left));
        }
    }

    /**
     * @dev Verifies a Merkle proof.
     */
    function verifyProof(
        bytes32 leaf,
        bytes32[] calldata proof,
        bytes32 root
    ) external pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == root;
    }
}
