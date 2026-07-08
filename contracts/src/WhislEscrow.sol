// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title WhislEscrow
/// @notice Shared-pledge football settlement escrow. N depositors fund one pot under one
///         trigger condition; a required confirmer signs off a room-agreed resolution; funds
///         settle to a fixed recipient or pro-rata back to depositors. There are no opposing
///         sides and no stake ever pays for another party being wrong (PRD section 1).
/// @dev    Holds a USD-T0-class ERC20 chosen per pot. All timing is enforced on-chain against
///         block.timestamp; the Pears room only mirrors these deadlines for display. Every
///         payout path is isolated per pot via potBalance so pots can never drain each other.
contract WhislEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum PotState {
        None,
        Funding,
        Ready,
        ResolutionSubmitted,
        Confirmed,
        Disputed,
        ResolutionFinal,
        Settled,
        RefundPending,
        Refunded,
        Swept,
        Cancelled
    }

    struct Pot {
        address creator;
        bytes32 matchId;
        bytes32 conditionHash;
        IERC20 token;
        address requiredConfirmer;
        address payoutRecipient; // address(0) => pro-rata split among depositors
        uint256 minTotalDeposit;
        uint256 maxTotalDeposit;
        uint256 fundingDeadline;
        uint256 resolutionDeadline;
        uint256 disputeWindowSeconds;
        uint256 disputeGraceSeconds;
        uint256 unclaimedSweepSeconds;
        uint256 totalDeposited;
        uint256 confirmedAt;
        uint256 disputedAt;
        uint256 finalizedAt;
        bytes32 resultHash;
        bytes32 evidenceHash;
        PotState state;
    }

    uint256 private potNonce;

    mapping(bytes32 => bool) private potExists;
    mapping(bytes32 => Pot) private pots;
    mapping(bytes32 => address[]) private depositorList;
    mapping(bytes32 => mapping(address => uint256)) private deposits;
    mapping(bytes32 => mapping(address => bool)) private isDepositor;
    mapping(bytes32 => mapping(address => bool)) private settled; // claimed or refunded
    mapping(bytes32 => uint256) private potBalance;

    event PotCreated(
        bytes32 indexed potId,
        address indexed creator,
        address token,
        address requiredConfirmer,
        address payoutRecipient,
        bytes32 matchId,
        bytes32 conditionHash,
        uint256 fundingDeadline,
        uint256 resolutionDeadline
    );
    event PotReady(bytes32 indexed potId, uint256 totalDeposited);
    event Deposited(bytes32 indexed potId, address indexed depositor, uint256 amount, uint256 totalDeposited);
    event ResolutionSubmitted(bytes32 indexed potId, address indexed submitter, bytes32 resultHash, bytes32 evidenceHash);
    event Confirmed(bytes32 indexed potId, address indexed confirmer, uint256 confirmedAt, uint256 disputeDeadline);
    event Disputed(bytes32 indexed potId, address indexed disputer, uint256 disputedAt, uint256 graceDeadline);
    event Resolved(bytes32 indexed potId, address indexed confirmer, bool approvePayout);
    event ResolutionFinalized(bytes32 indexed potId, uint256 finalizedAt);
    event RefundOpened(bytes32 indexed potId);
    event Claimed(bytes32 indexed potId, address indexed recipient, uint256 amount);
    event Refunded(bytes32 indexed potId, address indexed depositor, uint256 amount);
    event Swept(bytes32 indexed potId, address indexed caller, uint256 amount);

    modifier onlyRequiredConfirmer(bytes32 potId) {
        require(msg.sender == pots[potId].requiredConfirmer, "not confirmer");
        _;
    }

    /// @notice Create a pot. Caller is the organizer/creator; `requiredConfirmer` is the single
    ///         role (organizer or an explicitly assigned referee) allowed to confirm/resolve.
    function createPot(
        bytes32 matchId,
        bytes32 conditionHash,
        address token,
        address requiredConfirmer,
        address payoutRecipient,
        uint256 minTotalDeposit,
        uint256 maxTotalDeposit,
        uint256 fundingDeadline,
        uint256 resolutionDeadline,
        uint256 disputeWindowSeconds,
        uint256 disputeGraceSeconds,
        uint256 unclaimedSweepSeconds
    ) external returns (bytes32 potId) {
        require(token != address(0), "token=0");
        require(requiredConfirmer != address(0), "confirmer=0");
        require(minTotalDeposit > 0, "min=0");
        require(maxTotalDeposit >= minTotalDeposit, "max<min");
        require(fundingDeadline > block.timestamp, "deadline<=now");
        require(resolutionDeadline > fundingDeadline, "resDeadline<=funding");
        require(disputeWindowSeconds > 0, "window=0");
        require(disputeGraceSeconds > 0, "grace=0");
        require(unclaimedSweepSeconds > 0, "sweep=0");

        potId = keccak256(abi.encode(msg.sender, matchId, conditionHash, block.chainid, potNonce));
        require(!potExists[potId], "pot exists");
        potExists[potId] = true;
        unchecked {
            potNonce++;
        }

        Pot storage p = pots[potId];
        p.creator = msg.sender;
        p.matchId = matchId;
        p.conditionHash = conditionHash;
        p.token = IERC20(token);
        p.requiredConfirmer = requiredConfirmer;
        p.payoutRecipient = payoutRecipient;
        p.minTotalDeposit = minTotalDeposit;
        p.maxTotalDeposit = maxTotalDeposit;
        p.fundingDeadline = fundingDeadline;
        p.resolutionDeadline = resolutionDeadline;
        p.disputeWindowSeconds = disputeWindowSeconds;
        p.disputeGraceSeconds = disputeGraceSeconds;
        p.unclaimedSweepSeconds = unclaimedSweepSeconds;
        p.state = PotState.Funding;

        emit PotCreated(
            potId, msg.sender, token, requiredConfirmer, payoutRecipient, matchId, conditionHash, fundingDeadline, resolutionDeadline
        );
    }

    /// @notice Deposit `amount` of the pot token. Caller must `approve(escrow, amount)` first
    ///         (WDK flow is approve then deposit, two visible steps, never a hidden approve).
    function deposit(bytes32 potId, uint256 amount) external nonReentrant {
        Pot storage p = pots[potId];
        require(p.state == PotState.Funding || p.state == PotState.Ready, "not funding");
        require(block.timestamp <= p.fundingDeadline, "funding closed");
        require(amount > 0, "amount=0");
        require(p.totalDeposited + amount <= p.maxTotalDeposit, "exceeds max");

        if (!isDepositor[potId][msg.sender]) {
            isDepositor[potId][msg.sender] = true;
            depositorList[potId].push(msg.sender);
        }
        deposits[potId][msg.sender] += amount;
        p.totalDeposited += amount;
        potBalance[potId] += amount;
        if (p.state == PotState.Funding && p.totalDeposited >= p.minTotalDeposit) {
            p.state = PotState.Ready;
            emit PotReady(potId, p.totalDeposited);
        }

        p.token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(potId, msg.sender, amount, p.totalDeposited);
    }

    /// @notice Submit the room-agreed resolution + evidence hash. Callable by creator or the
    ///         required confirmer while awaiting confirmation; resubmission overwrites until
    ///         confirmed, after which the result is immutable.
    function submitResolutionHash(bytes32 potId, bytes32 resultHash, bytes32 evidenceHash) external {
        Pot storage p = pots[potId];
        require(msg.sender == p.creator || msg.sender == p.requiredConfirmer, "not authorized");
        require(p.state == PotState.Ready || p.state == PotState.ResolutionSubmitted, "not ready");
        require(block.timestamp <= p.resolutionDeadline, "resolution expired");
        require(resultHash != bytes32(0), "resultHash=0");

        p.resultHash = resultHash;
        p.evidenceHash = evidenceHash;
        p.state = PotState.ResolutionSubmitted;
        emit ResolutionSubmitted(potId, msg.sender, resultHash, evidenceHash);
    }

    /// @notice Required confirmer signs off the submitted resolution, opening the dispute window.
    function confirmResolution(bytes32 potId) external onlyRequiredConfirmer(potId) {
        Pot storage p = pots[potId];
        require(p.state == PotState.ResolutionSubmitted, "not submitted");
        require(block.timestamp <= p.resolutionDeadline, "resolution expired");
        p.confirmedAt = block.timestamp;
        p.state = PotState.Confirmed;
        emit Confirmed(potId, msg.sender, block.timestamp, block.timestamp + p.disputeWindowSeconds);
    }

    /// @notice Any depositor may flag a confirmed resolution within the dispute window.
    function openDispute(bytes32 potId) external {
        Pot storage p = pots[potId];
        require(p.state == PotState.Confirmed, "not confirmed");
        require(isDepositor[potId][msg.sender], "not depositor");
        require(block.timestamp <= p.confirmedAt + p.disputeWindowSeconds, "window closed");

        p.disputedAt = block.timestamp;
        p.state = PotState.Disputed;
        emit Disputed(potId, msg.sender, block.timestamp, block.timestamp + p.disputeGraceSeconds);
    }

    /// @notice Required confirmer resolves an open dispute within the grace period.
    /// @param approvePayout true => resolution stands and pot becomes claimable;
    ///        false => pot moves to refund.
    function resolveDispute(bytes32 potId, bool approvePayout) external onlyRequiredConfirmer(potId) {
        Pot storage p = pots[potId];
        require(p.state == PotState.Disputed, "not disputed");
        require(block.timestamp <= p.disputedAt + p.disputeGraceSeconds, "grace expired");

        emit Resolved(potId, msg.sender, approvePayout);
        if (approvePayout) {
            p.finalizedAt = block.timestamp;
            p.state = PotState.ResolutionFinal;
            emit ResolutionFinalized(potId, block.timestamp);
        } else {
            p.state = PotState.RefundPending;
            emit RefundOpened(potId);
        }
    }

    /// @notice Pull-based settlement. Single recipient claims the whole pot; for a pro-rata pot
    ///         each depositor claims their own share.
    function claim(bytes32 potId) external nonReentrant {
        _finalizeIfElapsed(potId);
        Pot storage p = pots[potId];
        require(p.state == PotState.ResolutionFinal, "not final");

        if (p.payoutRecipient != address(0)) {
            require(msg.sender == p.payoutRecipient, "not recipient");
            uint256 amt = potBalance[potId];
            require(amt > 0, "nothing");
            potBalance[potId] = 0;
            p.state = PotState.Settled;
            p.token.safeTransfer(p.payoutRecipient, amt);
            emit Claimed(potId, p.payoutRecipient, amt);
        } else {
            require(isDepositor[potId][msg.sender], "not depositor");
            require(!settled[potId][msg.sender], "already claimed");
            uint256 share = deposits[potId][msg.sender];
            require(share > 0, "nothing");
            settled[potId][msg.sender] = true;
            potBalance[potId] -= share;
            if (potBalance[potId] == 0) {
                p.state = PotState.Settled;
            }
            p.token.safeTransfer(msg.sender, share);
            emit Claimed(potId, msg.sender, share);
        }
    }

    /// @notice Pull-based refund of the caller's own deposit when the pot is refunding
    ///         (funding fell short of minimum by the deadline, or a dispute expired unresolved).
    function refund(bytes32 potId) external nonReentrant {
        _openRefundIfEligible(potId);
        Pot storage p = pots[potId];
        require(p.state == PotState.RefundPending, "no refund");
        require(isDepositor[potId][msg.sender], "not depositor");
        require(!settled[potId][msg.sender], "already refunded");

        uint256 amt = deposits[potId][msg.sender];
        require(amt > 0, "nothing");
        settled[potId][msg.sender] = true;
        potBalance[potId] -= amt;
        if (potBalance[potId] == 0) {
            p.state = PotState.Refunded;
        }
        p.token.safeTransfer(msg.sender, amt);
        emit Refunded(potId, msg.sender, amt);
    }

    /// @notice After the unclaimed-sweep window past finalization, anyone may push every
    ///         unclaimed depositor's share back to them pro-rata, closing the pot.
    function sweepUnclaimed(bytes32 potId) external nonReentrant {
        _finalizeIfElapsed(potId);
        Pot storage p = pots[potId];
        require(p.state == PotState.ResolutionFinal, "not final");
        require(block.timestamp >= p.finalizedAt + p.unclaimedSweepSeconds, "too early");

        address[] storage list = depositorList[potId];
        uint256 n = list.length;
        uint256 swept = 0;
        for (uint256 i = 0; i < n; i++) {
            address d = list[i];
            if (!settled[potId][d]) {
                uint256 amt = deposits[potId][d];
                if (amt > 0) {
                    settled[potId][d] = true;
                    potBalance[potId] -= amt;
                    swept += amt;
                    p.token.safeTransfer(d, amt);
                    emit Refunded(potId, d, amt);
                }
            }
        }
        p.state = PotState.Swept;
        emit Swept(potId, msg.sender, swept);
    }

    function _finalizeIfElapsed(bytes32 potId) internal {
        Pot storage p = pots[potId];
        if (p.state == PotState.Confirmed && block.timestamp > p.confirmedAt + p.disputeWindowSeconds) {
            p.finalizedAt = p.confirmedAt + p.disputeWindowSeconds;
            p.state = PotState.ResolutionFinal;
            emit ResolutionFinalized(potId, p.finalizedAt);
        }
    }

    function _openRefundIfEligible(bytes32 potId) internal {
        Pot storage p = pots[potId];
        // Disputed but grace expired unresolved => refund. A Funding pot past its deadline is
        // necessarily under-minimum (reaching the minimum moves it to Ready), so it also refunds.
        // A pot that is Ready/ResolutionSubmitted but never gets a confirmed resolution by the
        // resolution deadline (match cancelled, or the confirmer goes dark) => refund, so funds
        // are never permanently locked waiting on a confirmation that never comes.
        // A pot that reached its deadline with zero deposits is inert: no funds, no depositor to
        // trigger this, so it is represented as Cancelled only in the off-chain Pears room.
        if (p.state == PotState.Disputed && block.timestamp > p.disputedAt + p.disputeGraceSeconds) {
            p.state = PotState.RefundPending;
            emit RefundOpened(potId);
        } else if (p.state == PotState.Funding && block.timestamp > p.fundingDeadline) {
            p.state = PotState.RefundPending;
            emit RefundOpened(potId);
        } else if (
            (p.state == PotState.Ready || p.state == PotState.ResolutionSubmitted)
                && block.timestamp > p.resolutionDeadline
        ) {
            p.state = PotState.RefundPending;
            emit RefundOpened(potId);
        }
    }

    // --- views (for tests, the Pears room mirror, and any judge-facing indexer) ---

    function getPot(bytes32 potId) external view returns (Pot memory) {
        return pots[potId];
    }

    function potStateOf(bytes32 potId) external view returns (PotState) {
        return pots[potId].state;
    }

    function depositOf(bytes32 potId, address account) external view returns (uint256) {
        return deposits[potId][account];
    }

    function depositors(bytes32 potId) external view returns (address[] memory) {
        return depositorList[potId];
    }

    function balanceOfPot(bytes32 potId) external view returns (uint256) {
        return potBalance[potId];
    }

    function hasSettled(bytes32 potId, address account) external view returns (bool) {
        return settled[potId][account];
    }
}
