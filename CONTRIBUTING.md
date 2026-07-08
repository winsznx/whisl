# Contributing to Whisl

Thanks for your interest. Whisl is a P2P football settlement room built on Pears, QVAC, and WDK.

## Layout

- `contracts/` — Foundry project, `WhislEscrow.sol` (the settlement escrow). Tests + Slither gate.
- `room/` — Autobase-backed Pears room (the shared match-state log) and Hyperswarm transport.
- `app/` — WDK wallet + escrow integration, QVAC capture/delegation, and the tournament layer.
- `docs/` — architecture (with diagrams) and the running build log.

## Getting set up

- Contracts: `cd contracts && forge test` (needs Foundry). Deploy uses `script/roundtrip.mjs` (ethers).
- Room: `cd room && npm install && node --test`.
- App: `cd app && npm install && node --test`. On-chain scripts read a gitignored `contracts/.env`
  (`SEPOLIA_RPC`, `DEPLOYER_PK`); never commit keys.

## Ground rules

- **Copy discipline (non-negotiable).** Never use *bet, wager, odds, prediction market, gambling*.
  Whisl is a shared pledge with a referee-confirmed payout — use *pot, pledge, reward,
  referee-confirmed payout, tournament prize, watch-party reward*. See `docs/architecture.md`.
- **Security first.** The escrow holds real value. Any contract change must keep the full test
  suite green and pass the Slither gate (no medium+ severity, no high-confidence findings) before
  deploy. Never suppress a finding — fix it or justify it in `docs/build-log.md`.
- **No mocks in the product.** Testnet is the real thing. Unit tests may use a test ERC-20; the
  product uses real USD₮ on-chain.
- Match existing style; keep changes small and focused; add tests with behavior changes.

## Commits & PRs

- Keep history readable — group related work, write clear messages.
- Describe what changed, why, and how you verified it (tests, tx hashes, or a run log).
