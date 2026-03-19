// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev The on-chain address of the XCM (Cross-Consensus Messaging) precompile.
address constant XCM_PRECOMPILE_ADDRESS = 0x00000000000000000000000000000000000a0000;

/// @title XCM Precompile Interface
/// @notice Low-level interface for `pallet_xcm`
interface IXcm {
    /// @notice Weight v2 used for measurement for an XCM execution
    struct Weight {
        uint64 refTime;   // computational time on reference hardware
        uint64 proofSize; // size of the proof
    }

    /// @notice Executes an XCM message locally on the current chain (origin = caller)
    /// @dev Calls pallet_xcm::execute internally
    /// @param message SCALE-encoded VersionedXcm
    /// @param weight Maximum allowed weight (get from weighMessage!)
    function execute(bytes calldata message, Weight calldata weight) external;

    /// @notice Sends an XCM message to another parachain/consensus system
    /// @dev Calls pallet_xcm::send internally
    /// @param destination SCALE-encoded MultiLocation
    /// @param message SCALE-encoded VersionedXcm
    function send(bytes calldata destination, bytes calldata message) external;

    /// @notice Estimates weight required for a message
    /// @param message SCALE-encoded VersionedXcm
    /// @return weight refTime + proofSize
    function weighMessage(bytes calldata message) external view returns (Weight memory weight);
}
