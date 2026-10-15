#!/usr/bin/env bash
# One-command offline-ish acceptance check. No AWS mutations.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
echo '== Cognito self-signup trigger offline security tests =='
node --test scripts/test-cognito-trigger.mjs
echo '== Backend regression suite (local dev auth and JSON persistence) =='
AUTH_MODE=dev PERSISTENCE_BACKEND=json npm run test:backend
echo '== Production Vue build =='
npm run build
echo '== Source sanity checks =='
node --check backend/src/handlers/tickets.js
node --check backend/src/services/ticketService.js
if command -v sam >/dev/null 2>&1; then
  echo '== AWS API SAM lint =='
  sam validate --template-file infrastructure/api.yaml --lint
else
  echo 'NOTE: SAM CLI not installed, API template lint skipped.'
fi
if command -v cfn-lint >/dev/null 2>&1; then
  echo '== Cognito CloudFormation lint =='
  cfn-lint infrastructure/cognito.yaml
else
  echo 'NOTE: cfn-lint not installed; Cognito template AWS validation remains outstanding.'
fi
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check
fi
echo 'PASS: Final local checks completed.'
