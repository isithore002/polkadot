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

    /**
     * @dev Benchmarks a heavy computational loop of Keccak-256 hashes.
     * This simulates a compute-bound operation (e.g., ZK or heavy crypto)
     * to demonstrate PVM versus EVM efficiency.
     */
    function hashChain(bytes32 seed, uint256 rounds) external pure returns (bytes32) {
        bytes32 current = seed;
        for (uint256 i = 0; i < rounds; i++) {
            current = keccak256(abi.encodePacked(current));
        }
        return current;
    }

    /**
     * @dev Simulates a ZK-verifier workload: sequential keccak rounds that
     * mix accumulator state with the loop index, approximating the kind of
     * hash-chain computation inside a proof verifier.
     */
    function pairingLoop(uint256 rounds) external pure returns (uint256) {
        uint256 acc = 1;
        for (uint256 i = 0; i < rounds; i++) {
            acc = uint256(keccak256(abi.encodePacked(acc, i)));
        }
        return acc;
    }

    /**
     * @dev Simulates RSA-style big-integer exponentiation via repeated
     * multiply-mod. Stresses integer arithmetic throughput on both VMs.
     */
    function modExp(uint256 base, uint256 exp, uint256 mod) external pure returns (uint256) {
        uint256 result = 1;
        uint256 b = base % mod;
        for (uint256 i = 0; i < exp; i++) {
            result = (result * b) % mod;
        }
        return result;
    }

    /**
     * @dev Triple-nested loop summing i*j*k products, benchmarking raw
     * integer ALU throughput under O(n³) iteration count.
     */
    function matrixMul(uint256 n) external pure returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = 0; j < n; j++) {
                for (uint256 k = 0; k < n; k++) {
                    sum += i * j * k;
                }
            }
        }
        return sum;
    }
}
