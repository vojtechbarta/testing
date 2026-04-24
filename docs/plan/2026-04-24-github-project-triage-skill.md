Archived: 2026-04-24

# Implement GitHub Project Triage Skill

## Scope
Create a new skill in this repo that mirrors upstream `triage-issue` behavior and enforces this workflow:
- investigate bug root cause
- design TDD fix plan
- create issue automatically
- require adding issue to `https://github.com/users/vojtechbarta/projects/1`
- require project Status=`To triage` (hard fail if not possible)

## Files to add/update
- Add [`/Users/bartavoj/Documents/Testing/.cursor/skills/triage-issue/SKILL.md`](/Users/bartavoj/Documents/Testing/.cursor/skills/triage-issue/SKILL.md)
  - Keep upstream structure (Problem capture -> diagnosis -> fix approach -> TDD plan -> issue creation).
  - Add explicit project-tracking step after `gh issue create`.
  - Define failure policy: if project assignment or status update fails, workflow reports failure with remediation commands.
- Add [`/Users/bartavoj/Documents/Testing/.cursor/rules/triage-issue-skill-activation.mdc`](/Users/bartavoj/Documents/Testing/.cursor/rules/triage-issue-skill-activation.mdc)
  - Trigger on intents like: "triage bug", "investigate issue", "file bug with plan", "root cause + GitHub issue".
  - Instruct agent to apply the new skill before implementation.
- Update [`/Users/bartavoj/Documents/Testing/README.md`](/Users/bartavoj/Documents/Testing/README.md) (or nearest existing skills index section if present)
  - Briefly document the new triage workflow and expected GH CLI auth prerequisites.

## Implementation details
- **Skill body adaptation**
  - Preserve upstream issue template sections: `Problem`, `Root Cause Analysis`, `TDD Fix Plan`, `Acceptance Criteria`.
  - Keep root-cause writeup implementation-agnostic (no brittle line references).
  - Keep hands-off behavior (do not pause for review before creating issue).
- **Project integration behavior**
  - Resolve project/item linkage using `gh` commands (GraphQL/API path) after issue creation.
  - Set project field `Status` to option `To triage`.
  - Treat failures in project add/status set as terminal for the workflow (issue URL may still be shown for manual recovery).
- **Output contract**
  - Final skill output prints issue URL and one-line root cause summary.
  - If project step fails, output must include exact remediation commands.

## Validation plan
- Dry-run the command flow with a test issue title/body (no code changes outside skill/rule/docs).
- Verify generated issue lands in Project #1 and Status is `To triage`.
- Confirm rule activation wording is narrow enough to avoid over-triggering unrelated tasks.

## Notes
- Upstream reference: [mattpocock/skills triage-issue](https://github.com/mattpocock/skills/blob/main/triage-issue/SKILL.md)
- Chosen policy decisions:
  - project assignment required
  - auto-create issue
  - hard fail on project-link failure
  - set project state to `To triage`
