// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Precompile {
    function mint(address to, uint256 amount) external;
}

interface IXcm {
    function send(bytes32 dest, bytes calldata message) external;
}

interface IXcmV2 {
    function send(uint32 dest, bytes calldata message) external;
}

interface IPVM {
    function hashLeaf(bytes32 leaf) external view returns (bytes32);
    function hashPair(bytes32 left, bytes32 right) external view returns (bytes32);
    function verifyProof(bytes32 leaf, bytes32[] calldata proof, bytes32 root) external view returns (bool);
}

contract PVMark {
    address public rustContract;
    address public constant ERC20_PRECOMPILE = 0x0000000000000000000000000000000000000402;
    address public constant XCM_PRECOMPILE = 0x00000000000000000000000000000000000a0000;

    event BenchmarkResult(address indexed user, bytes32 root, bool verified);

    constructor(address _rustContract) {
        rustContract = _rustContract;
    }

    // --- Solidity internal variants ---

    function hashLeafSol(bytes32 leaf) public pure returns (bytes32) {
        return keccak256(abi.encode(leaf));
    }

    function hashPairSol(bytes32 left, bytes32 right) public pure returns (bytes32) {
        if (left < right) {
            return keccak256(abi.encodePacked(left, right));
        } else {
            return keccak256(abi.encodePacked(right, left));
        }
    }

    function verifyProofSol(
        bytes32 leaf,
        bytes32[] calldata proof,
        bytes32 root
    ) public pure returns (bool) {
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

    // --- Rust (PVM) delegating variants ---
    
    function hashLeafRust(bytes32 leaf) external view returns (bytes32) {
        return IPVM(rustContract).hashLeaf(leaf);
    }

    function hashPairRust(bytes32 left, bytes32 right) external view returns (bytes32) {
        return IPVM(rustContract).hashPair(left, right);
    }

    function verifyProofRust(
        bytes32 leaf,
        bytes32[] calldata proof,
        bytes32 root
    ) external returns (bool) {
        bool verified = IPVM(rustContract).verifyProof(leaf, proof, root);
        
        if (verified) {
            // Optional: Interact with precompiles to show integration
            try IERC20Precompile(ERC20_PRECOMPILE).mint(msg.sender, 1e18) {} catch {}
            
            bytes memory message = abi.encodePacked(root);
            try IXcm(XCM_PRECOMPILE).send(bytes32(0), message) {} catch {}
            
            emit BenchmarkResult(msg.sender, root, true);
        }
        
        return verified;
    }

    // --- XCM Precompile Integration (Method 3) ---

    /**
     * @notice Demonstrates XCM precompile integration from Solidity
     * @dev Sends a minimal XCM message to show PolkaVM → system pallet capability
     * @param paraId Target parachain ID (e.g., 1000 for Asset Hub)
     */
    function sendXcmPing(uint32 paraId) external {
        // Minimal XCM message (just demonstrates precompile call capability)
        bytes memory message = hex"00"; // Dummy payload

        // Call XCM precompile (0x804 is common XCM send interface)
        IXcmV2(XCM_PRECOMPILE).send(paraId, message);
    }
}
