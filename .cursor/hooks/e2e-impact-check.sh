#!/usr/bin/env bash

set -euo pipefail

status_lines="$(git status --porcelain -- frontend/src frontend/e2e frontend/playwright.config.ts || true)"
ui_changed=false
e2e_changed=false

while IFS= read -r line; do
  [[ -z "${line}" ]] && continue
  path="${line:3}"

  case "${path}" in
    frontend/src/*)
      ui_changed=true
      ;;
    frontend/e2e/*|frontend/playwright.config.ts)
      e2e_changed=true
      ;;
  esac
done <<< "${status_lines}"

if [[ "${ui_changed}" == "true" && "${e2e_changed}" == "false" ]]; then
  cat <<'EOF'
{
  "followup_message": "Frontend UI files changed under frontend/src without matching Playwright updates. Please evaluate E2E impact now (update frontend/e2e tests/pages or explicitly document why no E2E change is needed)."
}
EOF
  exit 0
fi

echo '{}'
