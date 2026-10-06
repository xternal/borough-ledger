#!/usr/bin/env bash
# CI: prove the production gate works (CLAUDE.md invariant 1).
#   While the data holds test values, build:prod must fail, and fail because of them.
#   Once none are left, build:prod must pass.
set -uo pipefail

count=$(pnpm --silent --filter @borough-ledger/schema report:test-values | awk 'NR==1 {print $1}')
if ! [[ "$count" =~ ^[0-9]+$ ]]; then
  echo "could not count test values (got: '$count')"; exit 1
fi
echo "Test values or cards in the data: $count"

log=$(mktemp)
pnpm build:prod 2>&1 | tee "$log"
built=${PIPESTATUS[0]}

if [ "$count" -gt 0 ]; then
  if [ "$built" -eq 0 ]; then
    echo "GATE BROKEN: the data has $count test values but the production build passed."; exit 1
  fi
  if ! grep -qE "TestDataInProductionError|check-test-values: production build renders" "$log"; then
    echo "The production build failed, but not because of test data. Fix the build error above."; exit 1
  fi
  echo "Gate works: production is blocked while $count test values remain."
  exit 0
fi

if [ "$built" -ne 0 ]; then
  echo "No test values remain, but the production build failed. Fix the build error above."; exit 1
fi
echo "No test values; production build passes."
