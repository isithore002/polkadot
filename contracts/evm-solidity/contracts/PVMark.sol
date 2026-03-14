// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Precompile {
    function mint(address beneficiary, uint256 amount) external returns (bool);
}

interface IXcm {
    function send(bytes32 dest, bytes calldata message) external returns (bool);
}

contract PVMark {
    address public rustContract;
    
    // Westend Asset Hub Precompile Addresses (Estimates)
    address constant ERC20_PRECOMPILE = 0x0000000100000000000000000000000001200000;
    address constant XCM_PRECOMPILE   = 0x000000000000000000000000000000000000000A;

    event BenchmarkResult(address indexed user, bytes32 root, bool verified);
    event BenchmarkRun(string fnName, uint256 gasUsed);

    constructor(address _rustContract) {
        rustContract = _rustContract;
    }

    // --- Rust delegating variants ---
    
    function hashLeafRust(bytes32 leaf) external view returns (bytes32) {
        (bool success, bytes memory result) = rustContract.staticcall(
            abi.encodeWithSelector(0x3b3b57de, leaf)
        );
        require(success, "PVMark: Rust hashLeaf failed");
        return abi.decode(result, (bytes32));
    }

    function hashPairRust(bytes32 left, bytes32 right) external view returns (bytes32) {
        (bool success, bytes memory result) = rustContract.staticcall(
            abi.encodeWithSelector(0x9fa1ab2b, left, right)
        );
        require(success, "PVMark: Rust hashPair failed");
        return abi.decode(result, (bytes32));
    }

    function verifyProofRust(bytes32 root, bytes32 leaf, bytes32[4] calldata proof) external returns (bool) {
        (bool success, bytes memory result) = rustContract.staticcall(
            abi.encodeWithSelector(0x8c0f4938, root, leaf, proof)
        );
        require(success, "PVMark: Rust verifyProof failed");
        bool verified = abi.decode(result, (bool));
        
        if (verified) {
            // Try to mint a reward token
            try IERC20Precompile(ERC20_PRECOMPILE).mint(msg.sender, 1e18) {} catch {}
            
            // Try to send an XCM message
            bytes memory message = abi.encodePacked(root);
            try IXcm(XCM_PRECOMPILE).send(bytes32(0), message) {} catch {}
            
            emit BenchmarkResult(msg.sender, root, true);
        }
        
        return verified;
    }

    // --- Pure Solidity baseline variants ---

    function hashLeafSol(bytes32 leaf) external pure returns (bytes32) {
        return keccak256(abi.encode(leaf));
    }

    function hashPairSol(bytes32 left, bytes32 right) external pure returns (bytes32) {
        if (left <= right) {
            return keccak256(abi.encodePacked(left, right));
        } else {
            return keccak256(abi.encodePacked(right, left));
        }
    }

    function verifyProofSol(bytes32 root, bytes32 leaf, bytes32[4] calldata proof) external pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 sibling = proof[i];
            if (computed <= sibling) {
                computed = keccak256(abi.encodePacked(computed, sibling));
            } else {
                computed = keccak256(abi.encodePacked(sibling, computed));
            }
        }
        return computed == root;
    }
}
