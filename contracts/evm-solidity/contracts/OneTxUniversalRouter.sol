// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IXcm.sol";

/**
 * @title XCMHelpers
 * @notice SCALE encoding helpers for XCM V5 messages
 * @dev Base library for building XCM messages in Solidity
 */
library XCMHelpers {
    /**
     * @notice Encodes a u32 in little-endian format (SCALE encoding)
     */
    function encodeU32LE(uint32 value) internal pure returns (bytes memory) {
        bytes memory encoded = new bytes(4);
        encoded[0] = bytes1(uint8(value));
        encoded[1] = bytes1(uint8(value >> 8));
        encoded[2] = bytes1(uint8(value >> 16));
        encoded[3] = bytes1(uint8(value >> 24));
        return encoded;
    }

    /**
     * @notice Encodes a u128 in little-endian format (SCALE encoding)
     */
    function encodeU128LE(uint128 value) internal pure returns (bytes memory) {
        bytes memory encoded = new bytes(16);
        for (uint256 i = 0; i < 16; i++) {
            encoded[i] = bytes1(uint8(value >> (i * 8)));
        }
        return encoded;
    }

    /**
     * @notice Encodes SCALE compact integer
     * @dev Handles values up to 2^30-1 (sufficient for most XCM use cases)
     */
    function encodeCompact(uint256 value) internal pure returns (bytes memory) {
        if (value < 64) {
            // Single byte mode: 0b00
            return abi.encodePacked(uint8(value << 2));
        } else if (value < 16384) {
            // Two byte mode: 0b01
            uint16 encoded = uint16((value << 2) | 1);
            return abi.encodePacked(uint8(encoded), uint8(encoded >> 8));
        } else if (value < 1073741824) {
            // Four byte mode: 0b10
            uint32 encoded = uint32((value << 2) | 2);
            bytes memory result = new bytes(4);
            result[0] = bytes1(uint8(encoded));
            result[1] = bytes1(uint8(encoded >> 8));
            result[2] = bytes1(uint8(encoded >> 16));
            result[3] = bytes1(uint8(encoded >> 24));
            return result;
        }
        revert("Value too large for compact encoding");
    }

    /**
     * @notice Builds a MultiLocation for Relay Chain
     * @return SCALE-encoded MultiLocation { parents: 1, interior: Here }
     */
    function buildRelayChainLocation() internal pure returns (bytes memory) {
        return hex"0100"; // parents=1, interior=Here
    }

    /**
     * @notice Builds a MultiLocation for a specific parachain
     * @param paraId The parachain ID
     * @return SCALE-encoded MultiLocation { parents: 1, interior: X1(Parachain(paraId)) }
     */
    function buildParachainLocation(uint32 paraId) internal pure returns (bytes memory) {
        bytes memory result = new bytes(6);
        result[0] = 0x01; // parents = 1
        result[1] = 0x00; // X1 (one junction)
        result[2] = 0x00; // Parachain variant

        // Encode paraId as u32 LE
        result[3] = bytes1(uint8(paraId));
        result[4] = bytes1(uint8(paraId >> 8));
        result[5] = bytes1(uint8(paraId >> 16));

        return result;
    }

    /**
     * @notice Builds a MultiLocation for AccountId32 on a parachain
     * @param paraId The parachain ID
     * @param accountId The 32-byte account ID
     */
    function buildAccountLocation(uint32 paraId, bytes32 accountId) internal pure returns (bytes memory) {
        bytes memory result = new bytes(40);
        result[0] = 0x01; // parents = 1
        result[1] = 0x01; // X2 (two junctions)
        result[2] = 0x00; // Parachain variant

        // Encode paraId as u32 LE
        result[3] = bytes1(uint8(paraId));
        result[4] = bytes1(uint8(paraId >> 8));
        result[5] = bytes1(uint8(paraId >> 16));

        result[6] = 0x01; // AccountId32 variant
        result[7] = 0x00; // network = Any

        // Copy accountId (32 bytes)
        for (uint256 i = 0; i < 32; i++) {
            result[8 + i] = accountId[i];
        }

        return result;
    }

    /**
     * @notice Builds a simple native asset MultiAsset (e.g., DOT)
     * @param amount Amount in plancks (smallest unit)
     */
    function buildNativeAsset(uint128 amount) internal pure returns (bytes memory) {
        bytes memory result = new bytes(20);
        result[0] = 0x00; // Concrete asset
        result[1] = 0x00; // Here location
        result[2] = 0x01; // Fungible variant

        // Amount as u128 LE
        for (uint256 i = 0; i < 16; i++) {
            result[3 + i] = bytes1(uint8(amount >> (i * 8)));
        }

        result[19] = 0x00; // Fun: Fungible

        return result;
    }
}

/**
 * @title OneTxUniversalRouter
 * @notice Universal cross-chain asset router using XCM precompiles
 * @dev Demonstrates Polkadot's native cross-chain messaging from smart contracts
 */
contract OneTxUniversalRouter {
    using XCMHelpers for *;

    IXcm public constant xcm = IXcm(XCM_PRECOMPILE_ADDRESS);

    /// @notice Emitted when assets are routed cross-chain
    event CrossChainRouted(
        address indexed caller,
        uint32 indexed destParaId,
        bytes32 beneficiary,
        uint128 amount,
        uint64 refTime,
        uint64 proofSize
    );

    /// @notice Emitted when XCM execution fails
    event RoutingFailed(address indexed caller, bytes reason);

    /**
     * @notice Routes native assets to another parachain
     * @param destParaId Target parachain ID (e.g., 2034 for Asset Hub)
     * @param beneficiary Recipient AccountId32 as bytes32
     * @param amount Amount in plancks (smallest unit)
     * @param feeAmount Fee to pay for execution (in plancks)
     */
    function routeToParachain(
        uint32 destParaId,
        bytes32 beneficiary,
        uint128 amount,
        uint128 feeAmount
    ) external payable {
        // Build XCM message: WithdrawAsset → BuyExecution → DepositAsset
        bytes memory xcmMsg = _buildTransferXcm(destParaId, beneficiary, amount, feeAmount);

        // Build destination
        bytes memory destination = XCMHelpers.buildParachainLocation(destParaId);

        try xcm.weighMessage(xcmMsg) returns (IXcm.Weight memory weight) {
            // Send XCM message
            xcm.send(destination, xcmMsg);

            emit CrossChainRouted(msg.sender, destParaId, beneficiary, amount, weight.refTime, weight.proofSize);
        } catch (bytes memory reason) {
            emit RoutingFailed(msg.sender, reason);
            revert("XCM routing failed");
        }
    }

    /**
     * @notice Routes native assets to Relay Chain
     * @param beneficiary Recipient AccountId32 as bytes32
     * @param amount Amount in plancks
     * @param feeAmount Fee for execution
     */
    function routeToRelayChain(
        bytes32 beneficiary,
        uint128 amount,
        uint128 feeAmount
    ) external payable {
        bytes memory xcmMsg = _buildTransferXcm(0, beneficiary, amount, feeAmount);
        bytes memory destination = XCMHelpers.buildRelayChainLocation();

        IXcm.Weight memory weight = xcm.weighMessage(xcmMsg);
        xcm.send(destination, xcmMsg);

        emit CrossChainRouted(msg.sender, 0, beneficiary, amount, weight.refTime, weight.proofSize);
    }

    /**
     * @notice Executes a custom XCM message locally
     * @param message SCALE-encoded VersionedXcm
     */
    function executeCustom(bytes calldata message) external {
        IXcm.Weight memory weight = xcm.weighMessage(message);
        xcm.execute(message, weight);
    }

    /**
     * @dev Builds a transfer XCM message (V5)
     * Structure: WithdrawAsset → BuyExecution → DepositAsset
     */
    function _buildTransferXcm(
        uint32 destParaId,
        bytes32 beneficiary,
        uint128 amount,
        uint128 feeAmount
    ) internal pure returns (bytes memory) {
        // V5 XCM version tag
        bytes memory xcm = hex"05";

        // Instruction count (compact encoded)
        xcm = abi.encodePacked(xcm, uint8(0x0c)); // 3 instructions

        // Instruction 1: WithdrawAsset
        xcm = abi.encodePacked(
            xcm,
            uint8(0x00), // WithdrawAsset variant
            uint8(0x04), // 1 asset (compact)
            XCMHelpers.buildNativeAsset(amount)
        );

        // Instruction 2: BuyExecution
        xcm = abi.encodePacked(
            xcm,
            uint8(0x01), // BuyExecution variant
            XCMHelpers.buildNativeAsset(feeAmount),
            uint8(0x00) // Unlimited weight
        );

        // Instruction 3: DepositAsset
        xcm = abi.encodePacked(
            xcm,
            uint8(0x0d), // DepositAsset variant
            uint8(0x01), // Wild::All
            uint8(0x01), // Max assets = 1
            XCMHelpers.buildAccountLocation(destParaId, beneficiary)
        );

        return xcm;
    }

    /**
     * @notice Check if XCM precompile is available
     */
    function isXcmAvailable() external view returns (bool) {
        uint256 size;
        address precompile = XCM_PRECOMPILE_ADDRESS;
        assembly {
            size := extcodesize(precompile)
        }
        return size > 0;
    }

    /**
     * @notice Test function - weighs a transfer message without sending
     * @dev Safe to call - only estimates weight
     */
    function testWeighTransfer(
        uint32 destParaId,
        bytes32 beneficiary,
        uint128 amount
    ) external view returns (IXcm.Weight memory) {
        bytes memory xcmMsg = _buildTransferXcm(destParaId, beneficiary, amount, 1000000000);
        return xcm.weighMessage(xcmMsg);
    }
}
