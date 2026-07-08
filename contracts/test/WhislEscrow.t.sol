// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {WhislEscrow} from "../src/WhislEscrow.sol";
import {MockUSDT0} from "./mocks/MockUSDT0.sol";

contract WhislEscrowTest is Test {
    WhislEscrow internal escrow;
    MockUSDT0 internal usdt;

    address internal organizer = makeAddr("organizer");
    address internal referee = makeAddr("referee");
    address internal recipient = makeAddr("recipient");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant BASE_TS = 1_700_000_000;
    bytes32 internal constant MATCH_ID = keccak256("NGA-vs-ARG");
    bytes32 internal constant CONDITION = keccak256("Nigeria scores");
    bytes32 internal constant RESULT_HASH = keccak256("Nigeria scored 1-0 minute 34");
    bytes32 internal constant EVIDENCE_HASH = keccak256("sha256-of-frame.jpg");

    uint256 internal constant MIN = 100e6;
    uint256 internal constant MAX = 1000e6;
    uint256 internal constant WINDOW = 120;
    uint256 internal constant GRACE = 120;
    uint256 internal constant SWEEP = 14 days;

    function setUp() public {
        vm.warp(BASE_TS);
        escrow = new WhislEscrow();
        usdt = new MockUSDT0();
        _fund(alice, 10_000e6);
        _fund(bob, 10_000e6);
        _fund(carol, 10_000e6);
    }

    // --- helpers ---

    function _fund(address who, uint256 amount) internal {
        usdt.mint(who, amount);
        vm.prank(who);
        usdt.approve(address(escrow), type(uint256).max);
    }

    function _createPot(address payoutRecipient) internal returns (bytes32 potId) {
        vm.prank(organizer);
        potId = escrow.createPot(
            MATCH_ID,
            CONDITION,
            address(usdt),
            referee,
            payoutRecipient,
            MIN,
            MAX,
            BASE_TS + 1 days,
            BASE_TS + 2 days,
            WINDOW,
            GRACE,
            SWEEP
        );
    }

    function _deposit(bytes32 potId, address who, uint256 amount) internal {
        vm.prank(who);
        escrow.deposit(potId, amount);
    }

    function _submitAndConfirm(bytes32 potId) internal {
        vm.prank(referee);
        escrow.submitResolutionHash(potId, RESULT_HASH, EVIDENCE_HASH);
        vm.prank(referee);
        escrow.confirmResolution(potId);
    }

    // --- happy paths ---

    function test_HappyPath_SingleRecipient_Claim() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, 60e6);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Funding));
        _deposit(potId, bob, 40e6); // crosses MIN => Ready
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Ready));

        _submitAndConfirm(potId);
        vm.warp(BASE_TS + 1 days + WINDOW + 1); // dispute window elapsed

        vm.prank(recipient);
        escrow.claim(potId);

        assertEq(usdt.balanceOf(recipient), 100e6);
        assertEq(escrow.balanceOfPot(potId), 0);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Settled));
    }

    function test_HappyPath_ProRata_EachClaims() public {
        bytes32 potId = _createPot(address(0)); // pro-rata split
        _deposit(potId, alice, 70e6);
        _deposit(potId, bob, 50e6); // total 120 >= MIN => Ready
        _submitAndConfirm(potId);
        vm.warp(BASE_TS + WINDOW + 1);

        uint256 aliceBefore = usdt.balanceOf(alice);
        uint256 bobBefore = usdt.balanceOf(bob);

        vm.prank(alice);
        escrow.claim(potId);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.ResolutionFinal));

        vm.prank(bob);
        escrow.claim(potId);

        assertEq(usdt.balanceOf(alice) - aliceBefore, 70e6);
        assertEq(usdt.balanceOf(bob) - bobBefore, 50e6);
        assertEq(escrow.balanceOfPot(potId), 0);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Settled));
    }

    function test_LazyFinalize_NoDispute() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        _submitAndConfirm(potId);
        // still Confirmed until someone touches it after the window
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Confirmed));
        vm.warp(BASE_TS + WINDOW + 1);
        vm.prank(recipient);
        escrow.claim(potId);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Settled));
    }

    // --- dispute paths ---

    function test_Dispute_Resolve_ApprovePayout_Claim() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, 60e6);
        _deposit(potId, bob, 60e6);
        _submitAndConfirm(potId);

        vm.warp(BASE_TS + 10);
        vm.prank(alice);
        escrow.openDispute(potId);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Disputed));

        vm.warp(BASE_TS + 20);
        vm.prank(referee);
        escrow.resolveDispute(potId, true); // resolution stands
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.ResolutionFinal));

        vm.prank(recipient);
        escrow.claim(potId);
        assertEq(usdt.balanceOf(recipient), 120e6);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Settled));
    }

    function test_Dispute_Resolve_Reject_Refund() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, 60e6);
        _deposit(potId, bob, 60e6);
        _submitAndConfirm(potId);

        vm.warp(BASE_TS + 10);
        vm.prank(bob);
        escrow.openDispute(potId);

        vm.warp(BASE_TS + 20);
        vm.prank(referee);
        escrow.resolveDispute(potId, false); // overturned => refund
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.RefundPending));

        vm.prank(alice);
        escrow.refund(potId);
        vm.prank(bob);
        escrow.refund(potId);

        assertEq(usdt.balanceOf(alice), 10_000e6);
        assertEq(usdt.balanceOf(bob), 10_000e6);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Refunded));
    }

    function test_Dispute_Expire_Grace_Refund() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, 60e6);
        _deposit(potId, bob, 60e6);
        _submitAndConfirm(potId);

        vm.warp(BASE_TS + 10);
        vm.prank(alice);
        escrow.openDispute(potId);

        // grace expires unresolved => refund path opens lazily on refund()
        vm.warp(BASE_TS + 10 + GRACE + 1);
        vm.prank(alice);
        escrow.refund(potId);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.RefundPending));
        vm.prank(bob);
        escrow.refund(potId);

        assertEq(usdt.balanceOf(alice), 10_000e6);
        assertEq(usdt.balanceOf(bob), 10_000e6);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Refunded));
    }

    // --- funding failure ---

    function test_Funding_UnderMin_Deadline_Refund() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, 30e6); // below MIN, stays Funding
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Funding));

        vm.warp(BASE_TS + 1 days + 1); // funding deadline passed, under minimum
        vm.prank(alice);
        escrow.refund(potId);

        assertEq(usdt.balanceOf(alice), 10_000e6);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Refunded));
    }

    // --- resolution-deadline escape (confirmer-liveness deadlock fix) ---

    function test_ResolutionDeadline_ReadyNeverConfirmed_Refund() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, 60e6);
        _deposit(potId, bob, 40e6); // Ready, but resolution never submitted/confirmed
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Ready));

        vm.warp(BASE_TS + 2 days + 1); // past resolutionDeadline
        vm.prank(alice);
        escrow.refund(potId);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.RefundPending));
        vm.prank(bob);
        escrow.refund(potId);

        assertEq(usdt.balanceOf(alice), 10_000e6);
        assertEq(usdt.balanceOf(bob), 10_000e6);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Refunded));
    }

    function test_ResolutionDeadline_SubmittedNeverConfirmed_Refund() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        vm.prank(referee);
        escrow.submitResolutionHash(potId, RESULT_HASH, EVIDENCE_HASH); // submitted, never confirmed
        vm.warp(BASE_TS + 2 days + 1);
        vm.prank(alice);
        escrow.refund(potId);
        assertEq(usdt.balanceOf(alice), 10_000e6);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Refunded));
    }

    function test_Revert_Confirm_AfterResolutionDeadline() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        vm.prank(referee);
        escrow.submitResolutionHash(potId, RESULT_HASH, EVIDENCE_HASH);
        vm.warp(BASE_TS + 2 days + 1);
        vm.prank(referee);
        vm.expectRevert(bytes("resolution expired"));
        escrow.confirmResolution(potId);
    }

    // --- sweep ---

    function test_Sweep_Unclaimed_SingleRecipient() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, 60e6);
        _deposit(potId, bob, 40e6);
        _submitAndConfirm(potId);

        // recipient never claims; sweep window passes past finalization
        vm.warp(BASE_TS + WINDOW + SWEEP + 1);
        vm.prank(stranger); // anyone can sweep
        escrow.sweepUnclaimed(potId);

        assertEq(usdt.balanceOf(alice), 10_000e6);
        assertEq(usdt.balanceOf(bob), 10_000e6);
        assertEq(usdt.balanceOf(recipient), 0);
        assertEq(escrow.balanceOfPot(potId), 0);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Swept));
    }

    function test_Sweep_Unclaimed_ProRata_Partial() public {
        bytes32 potId = _createPot(address(0));
        _deposit(potId, alice, 60e6);
        _deposit(potId, bob, 40e6);
        _submitAndConfirm(potId);

        vm.warp(BASE_TS + WINDOW + 1);
        vm.prank(alice);
        escrow.claim(potId); // alice claims, bob does not

        vm.warp(BASE_TS + WINDOW + SWEEP + 1);
        vm.prank(stranger);
        escrow.sweepUnclaimed(potId);

        assertEq(usdt.balanceOf(alice), 10_000e6); // got her 60 back via claim
        assertEq(usdt.balanceOf(bob), 10_000e6); // got his 40 back via sweep
        assertEq(escrow.balanceOfPot(potId), 0);
        assertEq(uint256(escrow.potStateOf(potId)), uint256(WhislEscrow.PotState.Swept));
    }

    // --- time-gate reverts ---

    function test_Revert_Deposit_AfterDeadline() public {
        bytes32 potId = _createPot(recipient);
        vm.warp(BASE_TS + 1 days + 1);
        vm.prank(alice);
        vm.expectRevert(bytes("funding closed"));
        escrow.deposit(potId, 60e6);
    }

    function test_Revert_Deposit_ExceedsMax() public {
        bytes32 potId = _createPot(recipient);
        vm.prank(alice);
        vm.expectRevert(bytes("exceeds max"));
        escrow.deposit(potId, MAX + 1);
    }

    function test_Revert_Deposit_AfterResolutionSubmitted() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        vm.prank(referee);
        escrow.submitResolutionHash(potId, RESULT_HASH, EVIDENCE_HASH);
        vm.prank(bob);
        vm.expectRevert(bytes("not funding"));
        escrow.deposit(potId, 10e6);
    }

    function test_Revert_OpenDispute_AfterWindow() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        _submitAndConfirm(potId);
        vm.warp(BASE_TS + WINDOW + 1);
        vm.prank(alice);
        vm.expectRevert(bytes("window closed"));
        escrow.openDispute(potId);
    }

    function test_Revert_Claim_BeforeFinal_DuringWindow() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        _submitAndConfirm(potId);
        // still inside the dispute window
        vm.prank(recipient);
        vm.expectRevert(bytes("not final"));
        escrow.claim(potId);
    }

    function test_Revert_Claim_WhileDisputed() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        _submitAndConfirm(potId);
        vm.warp(BASE_TS + 5);
        vm.prank(alice);
        escrow.openDispute(potId);
        vm.prank(recipient);
        vm.expectRevert(bytes("not final"));
        escrow.claim(potId);
    }

    function test_Revert_ResolveDispute_AfterGrace() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        _submitAndConfirm(potId);
        vm.warp(BASE_TS + 5);
        vm.prank(alice);
        escrow.openDispute(potId);
        vm.warp(BASE_TS + 5 + GRACE + 1);
        vm.prank(referee);
        vm.expectRevert(bytes("grace expired"));
        escrow.resolveDispute(potId, true);
    }

    function test_Revert_Sweep_TooEarly() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        _submitAndConfirm(potId);
        vm.warp(BASE_TS + WINDOW + 1); // final, but sweep window not elapsed
        vm.prank(stranger);
        vm.expectRevert(bytes("too early"));
        escrow.sweepUnclaimed(potId);
    }

    // --- auth reverts ---

    function test_Revert_Confirm_NotConfirmer() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        vm.prank(referee);
        escrow.submitResolutionHash(potId, RESULT_HASH, EVIDENCE_HASH);
        vm.prank(organizer);
        vm.expectRevert(bytes("not confirmer"));
        escrow.confirmResolution(potId);
    }

    function test_Revert_Resolve_NotConfirmer() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        _submitAndConfirm(potId);
        vm.warp(BASE_TS + 5);
        vm.prank(alice);
        escrow.openDispute(potId);
        vm.prank(alice);
        vm.expectRevert(bytes("not confirmer"));
        escrow.resolveDispute(potId, true);
    }

    function test_Revert_OpenDispute_NotDepositor() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        _submitAndConfirm(potId);
        vm.prank(stranger);
        vm.expectRevert(bytes("not depositor"));
        escrow.openDispute(potId);
    }

    function test_Revert_Claim_NotRecipient() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        _submitAndConfirm(potId);
        vm.warp(BASE_TS + WINDOW + 1);
        vm.prank(alice);
        vm.expectRevert(bytes("not recipient"));
        escrow.claim(potId);
    }

    function test_Revert_Submit_AfterConfirmed_Immutable() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        _submitAndConfirm(potId);
        vm.prank(referee);
        vm.expectRevert(bytes("not ready"));
        escrow.submitResolutionHash(potId, keccak256("different"), EVIDENCE_HASH);
    }

    function test_Revert_Submit_Unauthorized() public {
        bytes32 potId = _createPot(recipient);
        _deposit(potId, alice, MIN);
        vm.prank(stranger);
        vm.expectRevert(bytes("not authorized"));
        escrow.submitResolutionHash(potId, RESULT_HASH, EVIDENCE_HASH);
    }

    function test_Revert_DoubleClaim_ProRata() public {
        bytes32 potId = _createPot(address(0));
        _deposit(potId, alice, 60e6);
        _deposit(potId, bob, 60e6);
        _submitAndConfirm(potId);
        vm.warp(BASE_TS + WINDOW + 1);
        vm.prank(alice);
        escrow.claim(potId);
        vm.prank(alice);
        vm.expectRevert(bytes("already claimed"));
        escrow.claim(potId);
    }

    function test_Revert_CreatePot_BadParams() public {
        vm.startPrank(organizer);
        vm.expectRevert(bytes("token=0"));
        escrow.createPot(MATCH_ID, CONDITION, address(0), referee, recipient, MIN, MAX, BASE_TS + 1 days, BASE_TS + 2 days, WINDOW, GRACE, SWEEP);

        vm.expectRevert(bytes("max<min"));
        escrow.createPot(MATCH_ID, CONDITION, address(usdt), referee, recipient, MAX, MIN, BASE_TS + 1 days, BASE_TS + 2 days, WINDOW, GRACE, SWEEP);

        vm.expectRevert(bytes("deadline<=now"));
        escrow.createPot(MATCH_ID, CONDITION, address(usdt), referee, recipient, MIN, MAX, BASE_TS - 1, BASE_TS + 2 days, WINDOW, GRACE, SWEEP);

        vm.expectRevert(bytes("resDeadline<=funding"));
        escrow.createPot(MATCH_ID, CONDITION, address(usdt), referee, recipient, MIN, MAX, BASE_TS + 1 days, BASE_TS + 1 days, WINDOW, GRACE, SWEEP);
        vm.stopPrank();
    }

    // --- accounting isolation across pots ---

    function test_Isolation_TwoPots_NoCrossDrain() public {
        bytes32 potA = _createPot(recipient);
        _deposit(potA, alice, 100e6);
        _submitAndConfirm(potA);

        bytes32 potB = _createPot(address(0));
        _deposit(potB, bob, 100e6);
        _submitAndConfirm(potB);

        vm.warp(BASE_TS + WINDOW + 1);
        // recipient claims pot A only; must receive exactly pot A's 100, never pot B's funds
        vm.prank(recipient);
        escrow.claim(potA);
        assertEq(usdt.balanceOf(recipient), 100e6);
        assertEq(escrow.balanceOfPot(potB), 100e6); // untouched

        vm.prank(bob);
        escrow.claim(potB);
        assertEq(usdt.balanceOf(bob), 10_000e6);
    }
}
