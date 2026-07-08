# Whisl

*Turn the whistle into settlement.*

In football, the whistle is the signal everyone accepts. **Whisl** turns that signal into verified
settlement: match events are captured locally, confirmed by the room, synced peer-to-peer, and paid
out through self-custodial USD₮ wallets — no central server.

**GoalDrop** is the hero flow: capture a match event → local QVAC parse → room confirmation → WDK
payout. Built for the Tether Developers Cup on three load-bearing tracks:

- **Pears** — the serverless match room (Autobase shared log over Hyperswarm).
- **QVAC** — local, on-device match-evidence parsing (Qwen3-VL-2B multimodal).
- **WDK** — self-custodial USD₮ deposits, refunds, and payouts.

> **Shared pledge, not a bet.** N depositors fund one pot under one trigger condition; payout goes
> to a fixed recipient or splits pro-rata among depositors. Nobody's stake pays for someone else
> being wrong. No opposing sides, ever. See [copy rules](#copy-rules).

## Repository

| Path | What |
|---|---|
| [`contracts/`](contracts/) | Foundry project — `WhislEscrow.sol`, tests, Slither gate, deploy scripts |
| [`room/`](room/) | Pears room — Autobase + Hyperbee shared log, Hyperswarm transport |
| [`app/`](app/) | WDK wallet + escrow integration, QVAC capture/delegation, tournament layer |
| [`docs/architecture.md`](docs/architecture.md) | Architecture + state-model diagrams |
| [`docs/build-log.md`](docs/build-log.md) | Step-by-step build log with real testnet proof |
| [`deployments.json`](deployments.json) | Deployed addresses (single source of truth) |

## Deployed (Ethereum Sepolia, chainId 11155111)

- **WhislEscrow:** [`0xe93Eeb667bE8BBbB71993ca141B70F9CFF32b027`](https://sepolia.etherscan.io/address/0xe93Eeb667bE8BBbB71993ca141B70F9CFF32b027)
- **USD₮ (test):** `0xd077a400968890eacc75cdc901f0356c943e4fdb`

A full `createPot → deposit → confirmResolution → claim` round-trip has been executed on-chain — tx
hashes are in [the build log](docs/build-log.md).

## Run it locally

Whisl is local-first: you run your own node. Requirements: Node 20.9+ and (for the contract tests) Foundry.

```bash
git clone https://github.com/winsznx/whisl && cd whisl
npm run setup          # installs contracts, room, app, and web
```

Point the node at your own wallet. It is self-custodial and stays on your machine:

```bash
cp web/.env.example web/.env.local
# set WHISL_WALLET_SEED to your own BIP39 seed for a Sepolia wallet
```

Fund that wallet on Sepolia:
- Test USD-T: https://dashboard.pimlico.io/test-erc20-faucet
- Sepolia ETH for gas: any Sepolia faucet

Run the dashboard:

```bash
npm run dev            # http://localhost:3000
```

Tests:

```bash
cd contracts && forge test    # 29 escrow tests (add: slither . --filter-paths "node_modules|lib|test")
npm run test:room             # 9 room tests: conflict rules + two-peer sync
npm run test:web              # frontend logic tests
```

**On-device AI (optional).** QVAC capture uses `@qvac/sdk`, installed as an optional dependency; it
downloads the Qwen3-VL-2B model on first use. If it is not present, capture falls back to manual
entry and everything else works. The escrow and deploy scripts under `app/` read a gitignored
`contracts/.env` (`SEPOLIA_RPC`, `DEPLOYER_PK`). Never commit keys.

## Copy rules

Whisl's positioning is honest because the mechanic is a shared pledge. Language must reflect that:

- **Never:** bet, wager, odds, prediction market, gambling.
- **Always:** pot, pledge, reward, referee-confirmed payout, tournament prize, watch-party reward.

## Status

Backend/protocol stack complete (PRD build steps 1–7 and 9; fiat on-ramp out of scope; frontend not
started). See [docs/build-log.md](docs/build-log.md) for what's built, real tx hashes, SDK notes,
and the design-spec inputs needed to start the frontend.

## License

[MIT](LICENSE).
