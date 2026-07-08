# Whisl build log

A few lines per step: what was built, any decision the PRD didn't fully specify, the test result.

---

## Day 0 — validation (PRD §7)

| # | Check | Result |
|---|---|---|
| 1 | Plasma testnet RPC reachable / faucet | RPC **live**: `https://testnet-rpc.plasma.to`, `eth_chainId` = `0x2612` (**9746**), height ~0x1a6cc56. Faucet **blocked** — `gas.zip/faucet/plasma` requires a funded ETH-mainnet address (anti-spam); needs the operator. |
| 2 | `@qvac/sdk` + `@tetherto/wdk-wallet-evm` install | **Pass** — both public: `@qvac/sdk@0.14.1`, `@tetherto/wdk-wallet-evm@1.0.0-beta.15`. Pears stack also present (`autobase@7.28.1`, `hyperswarm@4.17.0`, `corestore@7.11.0`, `pear@2.0.4`). |
| 3 | QVAC loads Qwen3-VL-2B + mmproj, one real `completion()` | **Not run** — needs multi-GB model download + QVAC/Bare runtime. Deferred to step 4, pending operator go-ahead on the download. |
| 4 | Two-peer Hyperswarm cold start | **Not run** — deferred to step 2. Cold-start 15–45 s window confirmed in QVAC docs. |
| 5 | Escrow deploy + full round-trip tx hash | **Blocked** — needs a funded Plasma-testnet deployer key + testnet USD₮0. Contract + tests + Slither are done offline (see Step 1). |

### Real SDK vs PRD pseudocode (discrepancies)

- **Chain ID.** PRD §6.1 says Plasma `eip155:9745`; the live **testnet is 9746** (`0x2612`). 9745 is a different (mainnet-class) network. Build targets 9746.
- **USD₮0 address.** PRD's Plasma USD₮0 `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` has **no code on testnet** (`eth_getCode` → `0x`) — it's for another chain. The escrow therefore takes the token address as a per-pot parameter (see Step 1), so it's chain-agnostic; the testnet USD₮0 address still needs confirming before a live round-trip.
- **QVAC `completion()`.** Real API is `completion({ modelId, history, stream })` returning a `{ tokenStream, stats }` **stream**; attachments ride on `history` messages (`attachments: [{ path }]`), and the model + mmproj load together via `loadModel({ modelSrc, modelConfig: { ctx_size, projectionModelSrc } })`. PRD's "completion() takes attachments / returns structured JSON" is close but not literal — structured JSON has to be prompted for and parsed off the token stream.
- **Delegated inference.** Real API nests consumer options under a `delegate: { providerPublicKey, timeout, fallbackToLocal, forceNewConnection }` object — **not** `delegate: true`. Provider side is `startQVACProvider()` / `stopQVACProvider()`. 15–45 s cold start confirmed.
- **MoonPay.** Module is `@tetherto/wdk-protocol-fiat-moonpay` (not in the PRD Day-0 install line). **Out of scope now** — see below.

### Scope change — MoonPay/KYC dropped

Per operator direction, MoonPay fiat on-ramp and KYC are **removed from current scope** (was PRD §6.4 / build step 8). MVP funds a WDK wallet from a testnet faucet; no KYC is needed to prove Pears + QVAC + WDK. Nothing had been built for it.

---

## Step 1 — Escrow contract (`WhislEscrow.sol`)

**Built.** Foundry project under `contracts/`. `WhislEscrow.sol` implements the corrected §6.1 interface with all timing enforced on-chain against `block.timestamp`.

Applied operator corrections in full:
1. `createPot(matchId, conditionHash, token, requiredConfirmer, payoutRecipient, minTotalDeposit, maxTotalDeposit, fundingDeadline, resolutionDeadline, disputeWindowSeconds, disputeGraceSeconds, unclaimedSweepSeconds)` — all durations in **seconds**, no mixed units. (`resolutionDeadline` added per the deadlock decision below.)
2. On-chain enforcement of `fundingDeadline` (deposit), dispute window (openDispute), dispute grace (resolveDispute), finalization + `sweepAfter = finalizedAt + unclaimedSweepSeconds` (claim/sweep). The contract is what actually stops a late `openDispute` or an early `claim`; Pears only mirrors the countdowns.
3. `resolveDispute(potId, bool approvePayout)` — `true` → `ResolutionFinal`, `false` → `RefundPending`.
4. `confirmResolution` / `resolveDispute` are `onlyRequiredConfirmer`, checked against the pot's stored `requiredConfirmer`.
5. `deposit` uses `SafeERC20.safeTransferFrom` (real USD₮0 returns no bool), so the WDK flow is approve-then-deposit as two visible steps.
6. No MoonPay.

**Design decisions the PRD/§9 didn't fully lock:**
- **Per-pot token** (not a global immutable) — cleanly solves the wrong-testnet-USD₮0-address problem and lets Plasma/Stable coexist.
- **Required confirmer = an explicit address** passed at creation (organizer or an assigned referee), matching §9's "single role."
- **Pro-rata payout == each depositor's own deposit.** Since a pot's total payout equals its total deposits, a pro-rata split returns each depositor exactly what they put in — no rounding, no dust, and it keeps "nobody's stake pays for someone being wrong" literally true (PRD §1).
- **Pot accounting is isolated** via a per-pot `potBalance`; pots can never drain each other (tested).
- **Lazy transitions:** `Confirmed → ResolutionFinal` (dispute window elapsed) and `Disputed/Funding → RefundPending` (grace/funding-deadline elapsed) are realized inside `claim`/`refund`/`sweep`, keeping the interface to exactly the 8 spec functions with no keeper.

**Tests.** `forge test` → **29 passed, 0 failed.** Covers: happy path single-recipient claim, happy path pro-rata claim, dispute→resolve(approve)→claim, dispute→resolve(reject)→refund, dispute→grace-expiry→refund, funding-under-minimum→refund, resolution-deadline escape (Ready-never-confirmed and Submitted-never-confirmed → refund; late-confirm reverts), sweepUnclaimed (single-recipient and pro-rata-partial), cross-pot accounting isolation, lazy finalize, and the full set of time-gate + authorization + immutability reverts.

**Slither gate.** Ran `slither .` and read the output.
- First pass surfaced two Medium findings: `incorrect-equality` (Medium/High) on an enum `== PotState.None` existence check, and `uninitialized-local` (Medium) on the `swept` accumulator. Both are technically false-positive/benign, but they trip the deploy gate, so they were **fixed in code**, not waved off: existence check replaced with an explicit `potExists` bool mapping; `swept` initialized explicitly.
- Second pass: **clean of all medium+ severity and all high-confidence findings.** Remaining: `timestamp` (Low impact — inherent to a time-gated escrow, expected) and one third-party `operator-fee-outlier` gas advisory on the `sweepUnclaimed` loop.
- **Gate result: PASS** (only low/informational remain). Deploy is allowed by the gate — but is held at the operator boundary below because it needs funds.

**Resolved — confirmer-liveness deadlock (operator decision: add `resolutionDeadline`).**
A pot that reaches `Ready`/`ResolutionSubmitted` but never gets a *confirmed* resolution (match cancelled, or the confirmer disappears) used to have no refund escape — a genuine fund-lock for real USD₮. Fixed: `createPot` now takes a `resolutionDeadline` (must be > `fundingDeadline`); past it, `submitResolutionHash`/`confirmResolution` revert (`"resolution expired"`, so a late confirm can't race a refund) and any depositor can `refund`. Covered by three new tests.

**Open risk still flagged (documented tradeoff, not actioned):**
- **`sweepUnclaimed` is an unbounded loop.** Fine at watch-party scale (small N), and `maxTotalDeposit` caps value; but for a single-recipient pot with very many depositors where the recipient never claims, the sweep could exceed the block gas limit and lock funds (depositors have no individual pull path on the payout side). Recommendation for a later iteration: cap depositor count or paginate the sweep.

**Deploy boundary — STOP.** See the chain correction below; deploy target is now Ethereum Sepolia.

---

## Chain correction — Plasma → Ethereum Sepolia

**Why.** Tether's own docs describe no Plasma *testnet*. The `9746` / `testnet-rpc.plasma.to` endpoint that third-party RPC lists label "Plasma Testnet" is a **live, production-class chain**. Deploying there would have put a fresh, unaudited escrow onto a real chain by mistake. Corrected to Ethereum **Sepolia** before any deploy.

**Safety check (nothing moved).** Nothing was ever deployed to Plasma or any chain. The only Plasma interactions in this whole run were **three read-only JSON-RPC calls** (`eth_chainId`, `eth_blockNumber`, `eth_getCode`). No private key was ever held, no transaction was ever signed or broadcast, no funds moved. Confirmed.

**New target — Sepolia (verified read-only):**
- chainId `11155111`, RPC `https://sepolia.drpc.org` — reachable, live (block ~11,231,510).
- USDT `0xd077a400968890eacc75cdc901f0356c943e4fdb` — real contract on-chain: `symbol "USD₮"`, `name "Tether USD"`, `decimals 6`, bytecode present. This is passed straight into `createPot`'s `token` parameter — **no contract code changes** (the escrow was already chain-agnostic / per-pot token).
- Faucets for test ETH + USDT: pimlico test-erc20-faucet, candide faucet.

**Day 0 vs Sepolia — ALL GREEN.** RPC reachable ✅, USDT verified ✅, funded deployer ✅ (custos wallet `0x5C6C9e12D49e28670E00AD1C05f24243ad77Be13`, ~0.048 ETH + 4996 test USDT, derived via WDK `getAccount(0)`, path `m/44'/60'/0'/0/0`; key loaded file→file into gitignored `contracts/.env`, never printed). One real `deploy → createPot → approve → deposit → submit → confirm → claim` round-trip executed and settled — see Step 1 deploy proof below.

**Toolchain note (real vs expected).** The installed `forge`/`cast` is a **Tempo fork** (`1.6.0-t3-tempo`) whose provider expects a non-standard `timestampMillis` block field, so `forge create` / `cast send` cannot deserialize standard Sepolia blocks (`cast` *reads* are fine). Worked around by broadcasting with **ethers v6** ([`script/roundtrip.mjs`](../contracts/script/roundtrip.mjs)) against the standard solc bytecode. `script/roundtrip.sh` (cast-based) is kept for reference but the `.mjs` is the working path on this machine.

---

## Step 1 — deployed & proven on Ethereum Sepolia (chainId 11155111)

**WhislEscrow:** `0xe93Eeb667bE8BBbB71993ca141B70F9CFF32b027` — bytecode confirmed on-chain (14,606 chars).
**Token (test USDT):** `0xd077a400968890eacc75cdc901f0356c943e4fdb`.
**Pot:** `0x05f821254a6134f9decc99f4859e335de8fe5bc5a83c3862e4f0ad85d6378d50` → final state **7 = Settled**, `balanceOfPot = 0`. The 1 USDT round-tripped back to the deployer (deposit → claim as payout recipient): balance 4996000000 before and after.

Real transaction hashes (all mined on Sepolia):

| Step | Tx hash |
|---|---|
| deploy | `0xb662f47b16aaa7db6a24d6b7d3bd4b67077e319b48680d041f7588bbe2748f68` |
| createPot | `0x45b32bc78ac13dc077af813e6cc6bed65df61587eb6c689fe5c9f25a9b8fe362` |
| approve (USDT) | `0x203cd9493205ac0b816db8379885c1333b60915902f9335573c706d14c4fcc34` |
| deposit | `0xb7fde1976a6d41cbb799152a5abeaec834880b0bdd4191df55a992a8c87720d0` |
| submitResolutionHash | `0xe49c238af6c7634a70ae15289f7d7f62d35ef7782e6e94d3f7f78bc446b8550c` |
| confirmResolution | `0x2f7ea8b6b810e4047f57ff6d1062f8c3bb588d1a3bc58404d221969ac8138c90` |
| claim | `0x2312b912d7dc63f77296a8bb8f8d1f4df7000854abd21a0ee40674d336065af5` |

Verify: `https://sepolia.etherscan.io/address/0xe93Eeb667bE8BBbB71993ca141B70F9CFF32b027`. Step 1 is complete end-to-end (contract + 29 tests + Slither gate + live testnet round-trip).

---

## Step 2 — Pears room (Autobase shared log) ✅

**Built.** `room/` package: `WhislRoom` (`room/src/room.js`) is an Autobase v7 multi-writer log with a **Hyperbee view**; `room/src/swarm.js` joins peers over Hyperswarm on the base discovery key. Schema mirrors PRD §5 (roster, pot, proposals, confirmations, disputes, receipts).

**Conflict rules (PRD §6.2) enforced in `apply()`** — an op that violates a rule is dropped, never written to the view, so peers replaying the same inputs converge:
- unique `potId`; monotonic `eventNumber` per creator; every result carries a `resultHash`; dedup confirmations by signer; dedup deposits/receipts by `txHash`; a confirmed result is immutable (first confirm wins); an open dispute sets `disputeOpen` (freezes settlement).

**Real SDK vs memory.** Pulled the live Autobase v7 API before writing (`apply(nodes, view, host)`, `host.addWriter(key,{indexer:true})`, Hyperbee view via `open`). Also: **Corestore 7 dropped the `random-access-memory` factory** (new `hypercore-storage` backend needs a real path) — tests use temp dirs.

**Tests — `node --test` → 9 passed, 0 failed.** 8 deterministic single-base conflict-rule tests + 1 two-peer in-process replication test (peer B added as writer, writes a proposal, both peers converge on identical linearized state).

**Real Hyperswarm smoke (`room/script/swarm-smoke.mjs`).** Two peers over the actual DHT: **connected in 7.1s** and converged (A sees B's proposal). This also clears **Day-0 item 4** (two-peer Hyperswarm cold start) — observed 7.1s, within the PRD's 15–45s window. Pre-warm-before-demo guidance kept in `swarm.js`.

---

## Step 3 — WDK wallet + deposit flow ✅ (real Sepolia tx hashes)

**Built.** `app/` package: `app/src/wdk.js` wraps `@tetherto/wdk-wallet-evm` (beta.13, matching custos) — `loadWallet`, `createWallet` (fresh per-participant, PRD §6.4), `approveAndDeposit`. `app/script/wdk-deposit.mjs` drives it end-to-end against the deployed escrow. `deployments.json` at repo root is the single source of truth for deployed addresses.

**Operator rule 5 honored:** deposit is **two separately-signed, visible steps** — WDK-signed ERC-20 `approve`, then (after the approve receipt) WDK-signed `deposit` — never a single hidden-approve call.

**Real run (Sepolia, WDK-signed):**
- WDK wallet `0x5C6C9e12D49e28670E00AD1C05f24243ad77Be13`; fresh participant wallet created via WDK: `0x506e2Cad478aC16891fDF40aD2d4c1ca1A5E9B14`.
- createPot `0x712b0879f4e517f40c524cfd7da4875a02118ebbf36cb36626a03f1f473bea1f`
- approve `0x3409859c6f7837a873fd37d2fedc4a3ae9c39e282bea97464017119b75292b48` (status 1)
- deposit `0x7148a0ad1b9ae1a5b52cb052efdd25f544a3c5bd67b30eb143f3ebf462e5966f` (status 1)
- On-chain verified: `depositOf = 1000000` (1 USDT), pot state **2 = Ready**. potId `0x5525c5f07a9f27593e7c41521ecf072994f45a5d595dad66a7153bac98ffc42d`.

**SDK note:** WDK `account.sendTransaction`/`approve` work against standard Sepolia (unlike the tempo `forge`/`cast`). API matches the inspected beta.13 types (`approve({token,spender,amount})`, `sendTransaction({to,value,data,chainId})`, `getBalance`, `getTransactionReceipt`).

---

## Step 4 — QVAC capture pipeline ✅ (real local Qwen3-VL-2B inference)

**Built.** `app/src/qvac.js` — `loadVisionModel` (Qwen3-VL-2B + mmproj via `@qvac/sdk` constants `QWEN3VL_2B_MULTIMODAL_Q4_K` / `MMPROJ_QWEN3VL_2B_MULTIMODAL_Q4_K`), `parseFrame` (capture→file→`completion()`→structured JSON + **sha256 evidence hash**), and the **required `manualEntry` fallback** (PRD §6.3) triggered on parse-fail/low-confidence. `app/script/make-scoreboard.mjs` renders a real scoreboard PNG (sharp/SVG); `app/script/qvac-capture.mjs` runs the pipeline.

**Real run (local, darwin-arm64):** model loaded from `~/.qvac` cache; image encoded in 693ms; parsed in **2.9s**. Qwen3-VL-2B correctly read the frame:
`{"home_team":"Nigeria","away_team":"Argentina","home_score":1,"away_score":0,"event":"Nigeria scores","confidence":0.95}`.
evidenceHash `12e957ab3046ad8a57ab12af5a29a23107713e8a72110e28b89489ab9e4691b9`; resultHash `0xea586e8ee8327bb325c93e5024eaaa728241742f62be599b955a1c68c9fecb15`; conditionMet=true.

**Notes.** Real API used: `completion({ modelId, history:[{role,content,attachments:[{path}]}], stream:true })` → consume `tokenStream`, then `await stats`. Qwen3 hybrid-reasoning `<think>` blocks stripped before JSON extraction. `@qvac/sdk` (0.13.5) + Qwen3-VL-2B/mmproj weights are **reused from the local custos install** (`~/.qvac` model cache; `app/node_modules/@qvac` symlinked) to avoid a multi-GB duplicate — a standalone repo would `npm i @qvac/sdk`.

**Day 0 is now fully green** (item 3 — QVAC loads Qwen3-VL-2B + one real `completion()` — cleared here).

---

## Steps 5 & 6 — confirm/dispute logic + claim/receipt ✅ (real Sepolia, room-mirrored)

**Built.** `app/src/goaldrop.js` orchestrates each state change as BOTH a WDK-signed escrow tx (money truth) AND a Pears room op (shared-state mirror): `submitResolution`, `confirm` (required-confirmer only, on-chain enforced), `dispute` (any depositor, within the on-chain window), `resolveDispute`, `claimAndReceipt`, plus `disputeDeadline` (reads the on-chain `confirmedAt + disputeWindowSeconds` the room surfaces as a countdown). `room/src/room.js` gained an `openRoom(dir)` factory.

**Real run (`app/script/goaldrop-flow.mjs`, one wallet as all roles):** full path submit → confirm → **dispute → resolve(approve)** → claim, pot `0x1cabf454…1bfa`, ended **on-chain state 7 = Settled**. Room mirror after the run: `confirmedResultHash = 0xea586e…` (the real Step-4 QVAC resultHash), `disputeOpen = true`, `proposals = 1`, receipt tx written back. Tx hashes:
- createPot `0xd9d0c80b…0339` · deposit `0x6891eb74…b395` · submitResolutionHash `0xb7c2e6de…0219` · confirmResolution `0x7605cc41…082a` · openDispute `0x5540f6c6…8289` · resolveDispute `0x20c3e15e…8bcc6` · claim `0x0d85b170…6b38`

The proposal carried the genuine Step-4 QVAC output (evidenceHash `12e957ab…`, resultHash `0xea586e…`), so this is capture → parse → submit → confirm → dispute → resolve → settle → receipt end-to-end.

---

## Step 7 — Delegated inference ✅ (real DHT provider→consumer + fallback)

**Built.** `app/src/delegated.js` — `startProvider()` (organizer laptop: `startQVACProvider()` + **pre-warm** Qwen3-VL-2B so it's resident) and `delegatedParse()` (phone consumer: `loadModel({modelSrc, modelConfig:{projectionModelSrc}, delegate:{providerPublicKey, timeout:60000, fallbackToLocal:true}})` then the same `parseFrame`). `app/script/qvac-provider.mjs` (standalone provider) and `app/script/qvac-delegated.mjs` (composite: spawns provider, waits for its public key, runs the consumer, then a fallback demo).

**Real run.** Provider public key `ab1e0dd3…bc519`. Consumer **delegated parse connected + loaded in 8.3s** (under the 60s timeout) and parsed the scoreboard on the provider: `Nigeria 1-0, conf 0.95`. **Fallback demo:** bogus provider key + `fallbackToLocal` → silently parsed locally, correct result. Matches PRD §6.3 (≥60s first-connect timeout, pre-warm, fallback-to-local on handshake failure).

**Note.** Both processes run on one machine, so the consumer's image path is readable by the provider; true cross-device delegation of image attachments is a QVAC transport concern to validate on two physical devices before the live demo.

---

## Step 9 — Tournament wrapper ✅

**Built.** `app/src/tournament.js` — `createCup`, `registerTeam`, `addFixture` (each fixture can bind a `potId`), `recordResult` (immutable once set, like a confirmed pot), `standings` (points → GD → GF → name). This is the durable substrate that wraps the GoalDrop pot mechanic without being the pitch (PRD §1). A fixture's referee-confirmed pot settlement supplies the result that feeds the table.

**Tests — `node --test test/tournament.test.js` → 4 passed, 0 failed.** Standings math (W/D/L, GD ordering), fixture↔pot binding, result immutability, and guard rails (unknown teams, self-play, duplicate registration).

*(Step 8 MoonPay/KYC dropped per operator direction. Step 10 demo-polish is frontend and out of this build's scope — the prompt stops before frontend.)*

---

## Final status report

### What's built and passing (with proof)

**Backend/protocol stack complete: PRD build steps 1–7 and 9.** (Step 8 MoonPay/KYC dropped by
operator direction; Step 10 demo-polish is frontend, out of scope.)

- **Tests:** contracts **29** (`forge test`), room **9** (`node --test`), app tournament **4** — 42 total, all green.
- **Slither gate:** clean of all medium+ severity and high-confidence findings.
- **Deployed (Ethereum Sepolia, chainId 11155111):** WhislEscrow `0xe93Eeb667bE8BBbB71993ca141B70F9CFF32b027`, USD₮ `0xd077a400968890eacc75cdc901f0356c943e4fdb`. Deployer `0x5C6C9e12D49e28670E00AD1C05f24243ad77Be13`.
- **Live round-trips (real tx hashes):**
  - Step 1 deposit→claim→Settled: deploy `0xb662f47b…`, claim `0x2312b912…`.
  - Step 3 WDK deposit: createPot `0x712b0879…`, approve `0x340985…`, deposit `0x7148a0ad…`.
  - Steps 5–6 confirm/dispute/resolve/claim (pot `0x1cabf454…`): confirm `0x7605cc41…`, openDispute `0x5540f6c6…`, resolveDispute `0x20c3e15e…`, claim `0x0d85b170…`.
- **QVAC (local, real):** Qwen3-VL-2B parsed a scoreboard in 2.9s → `Nigeria 1-0`, conf 0.95, evidence hash `12e957ab…`.
- **P2P (real):** two-peer Hyperswarm converge in 7.1s; delegated inference connect+load 8.3s with fallback-to-local.

### Real SDK vs PRD pseudocode (consolidated)

- **Chain:** PRD Plasma `eip155:9745` → there is no Plasma testnet; built on **Sepolia 11155111**. Escrow is chain-agnostic (per-pot token), so this was a config change, not code.
- **QVAC `completion()`** is streaming: `completion({modelId, history:[{role,content,attachments:[{path}]}], stream})` → consume `tokenStream`, then `await stats`. Model+mmproj via `loadModel({modelSrc, modelConfig:{ctx_size, projectionModelSrc}})`. Constants `QWEN3VL_2B_MULTIMODAL_Q4_K` / `MMPROJ_QWEN3VL_2B_MULTIMODAL_Q4_K`. Qwen3 `<think>` blocks stripped before JSON parse.
- **Delegated inference** nests under `delegate:{providerPublicKey, timeout, fallbackToLocal, forceNewConnection}` (not `delegate:true`); provider via `startQVACProvider({firewall?})` → `{publicKey}`.
- **WDK:** `WalletManagerEvm(seed,{provider,chainId})`, `getAccount(i)`, `account.approve({token,spender,amount})`, `account.sendTransaction({to,value,data,chainId})`, `getBalance`, `getTransactionReceipt`. Works against standard Sepolia.
- **Corestore 7** dropped the `random-access-memory` factory (needs a real path).
- **Toolchain:** installed `forge`/`cast` is a Tempo fork expecting `timestampMillis` in blocks — can't deserialize standard Sepolia blocks, so deploys/sends go through **ethers v6**; `cast` reads are fine.

### Open decisions made (not fully locked by PRD §9)

- Per-pot `token` (not a global immutable) — makes the escrow chain/token-agnostic.
- Required confirmer is an explicit address at `createPot` (organizer or assigned referee).
- Pro-rata payout == each depositor's own deposit (no rounding/dust; keeps "no stake pays for another's loss" literal).
- Added `resolutionDeadline` to `createPot` (operator-approved) to close a confirmer-liveness fund-lock.
- `sweepUnclaimed` loops depositors — assumes watch-party-scale N; paginate for large pots later.
- QVAC SDK + Qwen3-VL-2B weights reused from the local custos install (`~/.qvac`, `app/node_modules/@qvac` symlink) to avoid a multi-GB duplicate; a standalone repo would `npm i @qvac/sdk`.

### What a frontend design spec needs

Backend surfaces are ready; the frontend needs a design spec covering these screens/flows, each of
which maps to an existing function/script:

1. **Wallet connect** — WDK wallet create/load, balance display (`app/src/wdk.js`).
2. **Pot creation** — organizer sets match, condition, min/max, deadlines, dispute window, recipient/split (`createPot`).
3. **Join / fund** — participant approve→deposit as two visible steps, tx-hash surfaced (`approveAndDeposit`).
4. **Capture / confirm** — capture frame → QVAC parse (or manual fallback) → proposal in room → required-confirmer sign-off, with a live dispute-window countdown (`qvac.js`, `goaldrop.js`, `disputeDeadline`).
5. **Dispute** — depositor flags within window; confirmer resolves; state surfaced from room + chain.
6. **Claim** — eligible party claims; tx confirms.
7. **Receipt** — receipt hash synced to every peer; exportable.
8. **Connection status** — live peer/DHT status + the pre-warm-before-recording routine (PRD step 10).
9. **Tournament** — cup/fixtures/standings view over the pot mechanic (`tournament.js`).

Copy throughout must follow the copy rules (pot/pledge/reward/referee-confirmed payout — never bet/wager/gambling).

**Frontend not started, as instructed — stopping here.**

---

## Frontend — Part 1 alignment audit + design-file conflict

**Part 1 audit (all four correct as deployed, `0xe93Eeb…b027`).**
1. `createPot` has all eleven listed params **plus a 12th, `resolutionDeadline`** (operator-approved earlier to close the confirmer-liveness fund-lock). Superset, not a mismatch — no fix/redeploy.
2. On-chain `block.timestamp` gates confirmed: `deposit`→`fundingDeadline` (L154), `openDispute`→`confirmedAt+disputeWindowSeconds` (L205), `resolveDispute`→`disputedAt+disputeGraceSeconds` (L218), `claim`→`_finalizeIfElapsed` derived deadline (L234/L311), `sweepUnclaimed`→`finalizedAt+unclaimedSweepSeconds` (L287).
3. `resolveDispute(bool approvePayout)` (L215) — not `upheld`.
4. `onlyRequiredConfirmer` (L90) applied to `confirmResolution` (L191) + `resolveDispute` (L215); covered by passing revert tests.

**Conflict flagged (per instruction — not silently resolved).** The two files in `internal/` (`desgn.md`, `designguide.md`) are a **visual design system only**, branded "Dayos / AI for Business" (SAP/Oracle/Workday 3D-cube imagery, "Schedule a Demo" CTAs). They fully specify tokens/type/spacing/radius/components/aesthetic, but contain **no page list, section list, routes, Whisl copy, or OG image spec** — which the Part-2 prompt says should come from the design files. Per the prompt ("ask rather than invent"), asked the operator; decision: **derive IA from the Part-2 Scope list + PRD, apply the Dayos design system verbatim, write Whisl copy per the copy rules.** Every route/section derived will be listed for review.

---

## Frontend — foundation + marketing + receipt (building green)

**Stack:** Next.js 16.2.10, React 19.2, Tailwind v4, viem 2.54 / wagmi 3.7 (reads), WDK stays the signing layer. `web/`.

**Route list (adopted from operator's brief; supersedes my earlier `/app/*` guess):**
- Public: `/` (marketing), `/receipt/[potId]` (shareable settlement receipt, OG-friendly)
- `/dashboard` (overview), `/dashboard/wallet`, `/dashboard/pots/new`, `/dashboard/pots/[potId]` (whole lifecycle on one state-conditional route), `/dashboard/tournaments/new`, `/dashboard/tournaments/[id]`, `/dashboard/tournaments/[id]/fixtures`, `/dashboard/tournaments/[id]/standings`, `/dashboard/history`.

**Design system.** `desgn.md` tokens verbatim in `globals.css` (@theme): warm-canvas #e5e5e5, flat cards, 32/48/64px radii, mint/yellow accents. Fonts via the design file's documented substitutes (Anton = SuisseIntlCond, Inter = SuisseIntl, JetBrains Mono = SuisseIntlMono). Copy discipline applied: plain words, no em dashes, never bet/wager/gambling.

**Built + building:** marketing `/` (nav pill, hero with scoreboard, GoalDrop steps, shared-pledge inverted block, three-track stack, tournament preview, live-on-Sepolia, footer), dynamic OG image (`next/og`), and `/receipt/[potId]` reading **real on-chain pot state** via viem (final reward, recipient, result/evidence hashes, state, escrow link). `next build` passes; ABI + `deployments.json` wired into `web/lib`.

**Architecture decision (write-bridge).** Per the prompt ("WDK stays the wallet/signing layer, don't duplicate in the frontend") and the custos edge-wallet pattern: on-chain **reads** run in the browser via viem; **writes** (createPot/deposit/confirm/dispute/resolve/claim) + QVAC parse + Pears room go through Next.js server actions that call the existing `room/` and `app/` Node modules using the server's funded WDK wallet. No central DB — the Next server process is itself a Pears peer + edge signer. `serverExternalPackages` set so the native modules aren't bundled.

**Remaining:** server-action write-bridge, the dashboard routes (wallet, pots/new, pot lifecycle, tournaments, history), component + e2e tests vs the real testnet, Railway deploy config, and the frontend status report.

---

## Frontend — complete (architecture corrected to per-participant local instances)

**Architecture (operator correction).** Rejected the shared edge-wallet-server model (WDK has no browser SDK; one server wallet signing for everyone is custodial and breaks the positioning). The app is **local-first: one instance per participant**, each running its own Pears peer + its own WDK wallet on its own machine. The web dashboard is the UI on top of *your own* node. No shared backend, no DB. `WHISL_WALLET_SEED` lives on the instance only and never reaches the browser.

**Bridge.** On-chain **reads** in the browser via viem. **Writes** (createPot/deposit/confirm/dispute/resolve/claim), **QVAC** capture, and the **Pears room** run through Next server actions on the participant's own node. The sibling `room/` and `app/` modules load via runtime dynamic import (`turbopackIgnore`) so Next never bundles the native deps; `serverExternalPackages` covers the rest. QVAC degrades gracefully to manual entry if the local model is absent.

**Content.** Uses `internal/whisl-frontend-content.md` verbatim for all copy, OG, and imagery (Cameroon scoreboard, the four GoalDrop steps, the "This is not a bet" block, GitHub/Docs/License footer). Dropped the Dayos SAP-cube renders per the imagery direction; flat ball-and-net wordmark instead. Copy discipline held (plain words, no em dashes). Noted: the content file's shared-pledge block deliberately uses "not a bet"/"not a wager" as rhetorical negations — used verbatim as locked wording.

**Routes built (exact to the operator's brief):** `/` (marketing), `/receipt/[potId]` (real on-chain reads + dynamic OG rendering the pot's actual state), `/dashboard` (overview), `/dashboard/wallet` (this instance's wallet + faucet), `/dashboard/pots/new`, `/dashboard/pots/[potId]` (whole lifecycle on one state-conditional route — fund → capture/confirm → dispute window → claim → receipt), `/dashboard/tournaments` + `/new` + `/[id]` + `/[id]/fixtures` + `/[id]/standings`, `/dashboard/history`.

**Verification:**
- `next build` passes (16 routes). Frontend logic tests: `npm test` → **5 passed** (standings, USD-T formatting, state labels, hashing).
- **Runtime smoke test (real):** started the instance with a funded wallet seed; `/dashboard/wallet` rendered the real derived address `0x5C6C…Be13` with live viem balances, and `/dashboard` opened the **Pears room at runtime** (Autobase store created at `.whisl-data/room`, no errors) — proving the WDK + viem + room bridge works end to end, not just at build.
- **GoalDrop e2e vs real testnet:** the full on-chain lifecycle (create → fund → submit → confirm → dispute → resolve → claim) is already proven on Sepolia by `app/script/goaldrop-flow.mjs` (Steps 5–6, real tx hashes) using the **same** `room/` + `app/` modules the dashboard server actions call; the runtime smoke test confirms the dashboard loads and drives them. A UI-driven Playwright pass was not added (needs the local QVAC model load + minutes of live txns); flagged here rather than faked.

**Deploy.** `railway.json` at repo root builds `room` + `web` and starts `next start` in `web` (numReplicas 1 — one instance = one participant). `web/.env.example` documents `WHISL_WALLET_SEED` + `NEXT_PUBLIC_SITE_URL`. **Constraint:** QVAC local capture needs the model weights + native runtime on the host (or a delegated QVAC provider); without it, capture falls back to manual entry. The marketing, receipt, on-chain (WDK/viem), and Pears-room surfaces deploy cleanly.

**Design-file gaps handled by asking, not inventing:** the two design files carried no IA/copy/OG (operator then supplied `whisl-frontend-content.md`) and the wallet architecture was corrected mid-build; both flagged here rather than silently resolved.
