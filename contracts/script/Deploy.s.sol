// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {WhislEscrow} from "../src/WhislEscrow.sol";

/// @notice Deploys WhislEscrow. No constructor args — the escrow holds many pots and each pot
///         carries its own token (Sepolia USDT is passed per-pot into createPot).
/// @dev    forge script script/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC \
///           --private-key $DEPLOYER_PK --broadcast
contract Deploy is Script {
    function run() external returns (WhislEscrow escrow) {
        vm.startBroadcast();
        escrow = new WhislEscrow();
        vm.stopBroadcast();
        console2.log("WhislEscrow deployed at:", address(escrow));
    }
}
