// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IXcm.sol";

/**
 * @title PVMarkXCM
 * @notice Demonstrates XCM precompile integration for cross-chain messaging
 * @dev Part of PVMark benchmark suite - shows PolkaVM's native XCM capabilities
 */
contract PVMarkXCM {
    IXcm public constant xcm = IXcm(XCM_PRECOMPILE_ADDRESS);

    /// @notice Emitted when an XCM message is executed locally
    event XcmExecuted(address indexed caller, uint64 refTime, uint64 proofSize);

    /// @notice Emitted when an XCM message is sent to another chain
    event XcmSent(address indexed caller, bytes32 indexed destinationHash);

    /// @notice Emitted when message weight is calculated
    event MessageWeighed(bytes32 indexed messageHash, uint64 refTime, uint64 proofSize);

    /// @notice Emitted when a benchmark completes
    event BenchmarkCompleted(string benchmarkType, uint256 gasUsed, bool success);

    /**
     * @dev Pre-encoded XCM V5 message: Simple transfer to Relay Chain
     * WithdrawAsset → BuyExecution → DepositAsset
     * From official Parity examples
     */
    function getSimpleTransferMessage() public pure returns (bytes memory) {
        return hex"050c000401000003008c86471301000003008c8647000d010101000000010100368e8759910dab756d344995f1d3c79374ca8f70066d3a709e48029f6bf0ee7e";
    }

    /**
     * @dev Pre-encoded destination: Relay Chain (parent = 1)
     * MultiLocation { parents: 1, interior: Here }
     */
    function getRelayChainDestination() public pure returns (bytes memory) {
        return hex"0100";
    }

    /**
     * @dev Pre-encoded destination: Parachain by ID
     * @param paraId The parachain ID (e.g., 2034 for Asset Hub)
     */
    function getParachainDestination(uint32 paraId) public pure returns (bytes memory) {
        // MultiLocation { parents: 1, interior: X1(Parachain(paraId)) }
        // SCALE encoding: 0x01 (parents=1) + 0x00 (X1) + 0x00 (Parachain variant) + paraId (u32 LE)
        bytes memory dest = new bytes(6);
        dest[0] = 0x01; // parents = 1
        dest[1] = 0x00; // X1 junction
        dest[2] = 0x00; // Parachain variant

        // Encode paraId as little-endian u32
        dest[3] = bytes1(uint8(paraId));
        dest[4] = bytes1(uint8(paraId >> 8));
        dest[5] = bytes1(uint8(paraId >> 16));

        return dest;
    }

    /**
     * @notice Weighs an XCM message to determine required execution resources
     * @param message SCALE-encoded VersionedXcm
     * @return weight The estimated Weight (refTime + proofSize)
     */
    function weighMessage(bytes calldata message) external returns (IXcm.Weight memory weight) {
        weight = xcm.weighMessage(message);
        emit MessageWeighed(keccak256(message), weight.refTime, weight.proofSize);
        return weight;
    }

    /**
     * @dev Sends a simple XCM transfer message
     * Uses hardcoded test vectors from Polkadot docs
     */
    function sendSimpleTransfer() external returns (bytes memory) {
        // Hardcoded XCM message for simple token transfer (from Polkadot docs)
        // This is a DescendOrigin + WithdrawAsset + BuyExecution + DepositAsset sequence
        bytes memory message = hex"031000040000000007f071c89e130a130000000007f071c89e1300010300286bee0d010004000101003cbd2d43530a44705ad088af313e18f80b53ef16b36177cd4b77b846f2a5f07c";

        bytes32 messageHash = keccak256(message);

        // Get weight estimate
        uint256 weight = IXcmTransactor(XCM_PRECOMPILE).weighMessage(message);
        emit XCMMessageSent(messageHash, weight);

        // Execute with estimated weight + 20% buffer
        uint64 maxWeight = uint64((weight * 120) / 100);
        bytes memory result = IXcmTransactor(XCM_PRECOMPILE).execute(message, maxWeight);

        emit XCMMessageExecuted(messageHash, result);
        return result;
    }

    /**
     * @dev Benchmark: XCM message weight calculation
     * Measures gas cost of weight estimation
     */
    function benchmarkXCMWeighing() external returns (uint256 gasUsed) {
        bytes memory testMessage = hex"031000040000000007f071c89e130a130000000007f071c89e1300010300286bee0d010004000101003cbd2d43530a44705ad088af313e18f80b53ef16b36177cd4b77b846f2a5f07c";

        uint256 gasBefore = gasleft();
        IXcmTransactor(XCM_PRECOMPILE).weighMessage(testMessage);
        gasUsed = gasBefore - gasleft();

        emit BenchmarkCompleted("XCM_WEIGH", gasUsed, true);
        return gasUsed;
    }

    /**
     * @dev Benchmark: Full XCM message execution
     * Measures complete XCM send cycle
     */
    function benchmarkXCMExecution() external returns (uint256 gasUsed, bool success) {
        bytes memory testMessage = hex"031000040000000007f071c89e130a130000000007f071c89e1300010300286bee0d010004000101003cbd2d43530a44705ad088af313e18f80b53ef16b36177cd4b77b846f2a5f07c";

        uint256 gasBefore = gasleft();

        try IXcmTransactor(XCM_PRECOMPILE).execute(testMessage, 100000000000) returns (bytes memory) {
            gasUsed = gasBefore - gasleft();
            success = true;
        } catch {
            gasUsed = gasBefore - gasleft();
            success = false;
        }

        emit BenchmarkCompleted("XCM_EXECUTE", gasUsed, success);
        return (gasUsed, success);
    }

    /**
     * @dev Send custom XCM message
     * Allows testing arbitrary XCM payloads
     */
    function sendCustomXCM(bytes calldata message, uint64 maxWeight) external returns (bytes memory) {
        bytes32 messageHash = keccak256(message);
        emit XCMMessageSent(messageHash, maxWeight);

        bytes memory result = IXcmTransactor(XCM_PRECOMPILE).execute(message, maxWeight);
        emit XCMMessageExecuted(messageHash, result);

        return result;
    }

    /**
     * @dev Check if XCM precompile is available
     * Returns true if bytecode exists at precompile address
     */
    function isXCMAvailable() external view returns (bool) {
        uint256 size;
        address precompile = XCM_PRECOMPILE;
        assembly {
            size := extcodesize(precompile)
        }
        return size > 0;
    }
}
