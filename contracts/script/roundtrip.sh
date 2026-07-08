#!/usr/bin/env bash
# Day 0 item 5 — one real approve->deposit->confirmResolution->claim round trip on Sepolia.
# Reads secrets from contracts/.env (gitignored); never echoes the private key.
#
#   contracts/.env must define:
#     SEPOLIA_RPC=https://sepolia.drpc.org
#     DEPLOYER_PK=0x....           # funded Sepolia wallet (ETH for gas + test USDT)
#
# Usage:  cd contracts && bash script/roundtrip.sh
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; source .env; set +a

RPC="${SEPOLIA_RPC:?set SEPOLIA_RPC in .env}"
: "${DEPLOYER_PK:?set DEPLOYER_PK in .env}"
USDT="0xd077a400968890eacc75cdc901f0356c943e4fdb"
CHAINID=11155111

DEPLOYER=$(cast wallet address --private-key "$DEPLOYER_PK")
echo "Deployer: $DEPLOYER"

ethbal=$(cast balance "$DEPLOYER" --rpc-url "$RPC")
usdtbal=$(cast call "$USDT" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$RPC" | awk '{print $1}')
echo "ETH (wei): $ethbal"
echo "USDT (6dp): $usdtbal"
if [ "$ethbal" = "0" ]; then echo "!! No Sepolia ETH for gas. Fund via a Sepolia faucet."; exit 1; fi
if [ "$usdtbal" = "0" ]; then echo "!! No test USDT. Get some from pimlico/candide faucet to $DEPLOYER."; exit 1; fi

echo "== deploy WhislEscrow =="
ESCROW=$(forge create src/WhislEscrow.sol:WhislEscrow --rpc-url "$RPC" --private-key "$DEPLOYER_PK" --broadcast --json | sed -n 's/.*"deployedTo":"\([^"]*\)".*/\1/p')
echo "Escrow: $ESCROW"

MATCHID=$(cast keccak "NGA-vs-ARG-2026")
CONDITION=$(cast keccak "Nigeria scores")
NOW=$(cast block latest --rpc-url "$RPC" -f timestamp)
FDL=$((NOW + 3600))
RDL=$((NOW + 7200))
WINDOW=30; GRACE=30; SWEEP=1209600
MIN=1000000; MAX=1000000000; AMOUNT=1000000   # 1 USDT (6dp)

# potId is deterministic for the first pot on a fresh escrow (potNonce = 0)
POTID=$(cast keccak "$(cast abi-encode 'x(address,bytes32,bytes32,uint256,uint256)' "$DEPLOYER" "$MATCHID" "$CONDITION" "$CHAINID" 0)")
echo "Expected potId: $POTID"

send() { echo ">> $1"; cast send --rpc-url "$RPC" --private-key "$DEPLOYER_PK" "${@:2}" | sed -n 's/^transactionHash *\(.*\)/  tx: \1/p'; }

send "createPot" "$ESCROW" \
  "createPot(bytes32,bytes32,address,address,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256)" \
  "$MATCHID" "$CONDITION" "$USDT" "$DEPLOYER" "$DEPLOYER" "$MIN" "$MAX" "$FDL" "$RDL" "$WINDOW" "$GRACE" "$SWEEP"

send "approve USDT" "$USDT" "approve(address,uint256)" "$ESCROW" "$AMOUNT"
send "deposit" "$ESCROW" "deposit(bytes32,uint256)" "$POTID" "$AMOUNT"
send "submitResolutionHash" "$ESCROW" "submitResolutionHash(bytes32,bytes32,bytes32)" "$POTID" "$(cast keccak 'Nigeria 1-0 min34')" "$(cast keccak 'sha256-frame')"
send "confirmResolution" "$ESCROW" "confirmResolution(bytes32)" "$POTID"

echo "== waiting out the ${WINDOW}s dispute window =="
sleep $((WINDOW + 5))

send "claim" "$ESCROW" "claim(bytes32)" "$POTID"

echo "== final state =="
echo -n "pot state (7 == Settled): "; cast call "$ESCROW" "potStateOf(bytes32)(uint8)" "$POTID" --rpc-url "$RPC"
echo -n "recipient USDT: "; cast call "$USDT" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$RPC"
