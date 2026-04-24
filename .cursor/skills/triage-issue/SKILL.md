---
name: triage-issue
description: Triage a bug by investigating root cause, designing a TDD fix plan, creating a GitHub issue, and adding it to GitHub Project #1 with Status set to `To triage`. Use when user reports a bug, asks to triage, or requests an issue with investigation + fix plan.
---

# Triage Issue (GitHub Project workflow)

Investigate a reported problem, find root cause, and create a GitHub issue with a TDD fix plan.

This workflow is mostly hands-off: minimize user questions, investigate first, then create the issue.

## Prerequisites

Before project operations, ensure GitHub CLI auth has project scopes:

```bash
gh auth refresh -s read:project,project
```

## Process

### 1. Capture the problem

Get a brief issue description from the user.

If missing, ask exactly one question:
"What's the problem you're seeing?"

Do not ask follow-up questions yet. Start investigating immediately.

### 2. Explore and diagnose

Use `Subagent` with `subagent_type=explore` for deeper investigation when scope is broad. Identify:

- where the bug manifests (UI/API/behavior)
- what code path is involved
- why it fails (root cause, not just symptom)
- what related code and tests already exist

Check:

- source modules in the affected path and dependencies
- existing tests (covered behavior and gaps)
- recent changes on affected files (`git log` per file)
- error handling in the failing path
- similar working patterns elsewhere in this repo

### 3. Identify fix approach

Determine:

- minimal root-cause fix
- affected public interfaces/contracts
- behavior that must be verified by tests
- whether this is regression, missing guard, or design flaw

### 4. Design TDD fix plan

Write ordered RED-GREEN cycles:

1. **RED**: one concrete behavior test capturing the problem
   **GREEN**: minimal change to pass the test
2. Repeat with next behavior slice

Rules:

- test behavior via public interfaces, not internals
- one vertical slice at a time
- prefer durable assertions that survive refactors
- include final `REFACTOR` step when useful

### 5. Create issue and enforce Project placement

Create issue with `gh issue create` using the template below.
Do not pause for manual review before creating.

After issue creation, you MUST:

1. add issue to GitHub Project #1 (`vojtechbarta/projects/1`)
2. set Project Status field to `To triage`

If either step fails, treat the workflow as failed and return remediation commands.

Recommended command flow:

```bash
# 1) Create issue in current repo
ISSUE_URL="$(gh issue create --title "$TITLE" --body "$BODY" --label bug)"

# 2) Derive issue node id
ISSUE_NODE_ID="$(gh api graphql -f query='
  query($url: URI!) {
    resource(url: $url) {
      ... on Issue { id }
    }
  }
' -f url="$ISSUE_URL" --jq '.data.resource.id')"

# 3) Add issue to user project #1 and capture created project item id
ITEM_ID="$(gh api graphql -f query='
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
      item { id }
    }
  }
' -f projectId="$PROJECT_ID" -f contentId="$ISSUE_NODE_ID" --jq '.data.addProjectV2ItemById.item.id')"

# 4) Set single-select field "Status" to option "To triage"
gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: {singleSelectOptionId: $optionId}
    }) { projectV2Item { id } }
  }
' -f projectId="$PROJECT_ID" -f itemId="$ITEM_ID" -f fieldId="$STATUS_FIELD_ID" -f optionId="$TO_TRIAGE_OPTION_ID"
```

Resolve these IDs at runtime via `gh api graphql`:
- `PROJECT_ID` for `https://github.com/users/vojtechbarta/projects/1`
- `STATUS_FIELD_ID` for field named `Status`
- `TO_TRIAGE_OPTION_ID` for option named `To triage`

Failure policy:
- If project add or status update fails, report failure, include `ISSUE_URL`, and provide exact commands to finish manually.
- If auth scopes are missing, remediation must include `gh auth refresh -s read:project,project`.

## Issue template

Use this template body:

```markdown
## Problem

A clear description of the issue:
- Actual behavior
- Expected behavior
- Reproduction steps (if relevant)

## Root Cause Analysis

Describe the behavioral root cause and why the current implementation fails.
Keep this implementation-agnostic: avoid file paths/line numbers/internal details.

## TDD Fix Plan

1. **RED**: Write a test that [expected behavior].
   **GREEN**: [Minimal code change].

2. **RED**: Write a test that [next behavior].
   **GREEN**: [Minimal code change].

**REFACTOR**: [Post-green cleanup, if needed].

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] New tests pass
- [ ] Existing tests still pass
```

## Final output contract

Always end with:

- created issue URL
- one-line root cause summary
- project placement result (`added + Status=To triage`)

If project operations fail, include:

- failure reason
- exact manual remediation commands
- explicit statement that workflow did not complete successfully
