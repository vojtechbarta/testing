#!/usr/bin/env bash

set -euo pipefail

status_lines="$(git status --porcelain -- README.md README.cs.md || true)"
readme_changed=false
readme_cs_changed=false

while IFS= read -r line; do
  [[ -z "${line}" ]] && continue
  path="${line:3}"
  case "${path}" in
    README.md)
      readme_changed=true
      ;;
    README.cs.md)
      readme_cs_changed=true
      ;;
  esac
done <<< "${status_lines}"

if [[ "${readme_changed}" == "true" && "${readme_cs_changed}" == "false" ]]; then
  cat <<'EOF'
{
  "followup_message": "README.md changed without matching README.cs.md update. Please sync Czech README now (structure, commands, links, and language switch line)."
}
EOF
  exit 0
fi

echo '{}'
