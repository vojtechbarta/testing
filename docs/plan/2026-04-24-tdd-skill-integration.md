Archived: 2026-04-24

# Integrate TDD Skill (Upstream-Aligned)

## Goal
Create a first-class TDD skill under this workspace that stays structurally close to upstream while being practical for this repo’s backend + Playwright workflow.

## What I will add
- New skill folder: [`/Users/bartavoj/Documents/Testing/.cursor/skills/tdd/`]( /Users/bartavoj/Documents/Testing/.cursor/skills/tdd/ )
- Core files aligned to upstream:
  - [`/Users/bartavoj/Documents/Testing/.cursor/skills/tdd/SKILL.md`]( /Users/bartavoj/Documents/Testing/.cursor/skills/tdd/SKILL.md )
  - [`/Users/bartavoj/Documents/Testing/.cursor/skills/tdd/tests.md`]( /Users/bartavoj/Documents/Testing/.cursor/skills/tdd/tests.md )
  - [`/Users/bartavoj/Documents/Testing/.cursor/skills/tdd/mocking.md`]( /Users/bartavoj/Documents/Testing/.cursor/skills/tdd/mocking.md )
  - [`/Users/bartavoj/Documents/Testing/.cursor/skills/tdd/interface-design.md`]( /Users/bartavoj/Documents/Testing/.cursor/skills/tdd/interface-design.md )
  - [`/Users/bartavoj/Documents/Testing/.cursor/skills/tdd/deep-modules.md`]( /Users/bartavoj/Documents/Testing/.cursor/skills/tdd/deep-modules.md )
  - [`/Users/bartavoj/Documents/Testing/.cursor/skills/tdd/refactoring.md`]( /Users/bartavoj/Documents/Testing/.cursor/skills/tdd/refactoring.md )

## Adaptation approach (close-to-upstream)
- Keep upstream structure, section order, and red-green-refactor guidance nearly unchanged.
- Localize examples where useful:
  - backend API/service behavior tests (public interface focus)
  - UI-flow expectations that map to Playwright-level behavior checks
- Preserve upstream anti-pattern guidance (avoid horizontal slicing).
- Keep "mock at boundaries" guidance, with repo-relevant boundaries (external APIs, time/randomness, DB strategy notes).

## Rule wiring for automatic use
- Add a new workspace rule file in [`/Users/bartavoj/Documents/Testing/.cursor/rules/`]( /Users/bartavoj/Documents/Testing/.cursor/rules/ ) that instructs the agent to use the `tdd` skill when user intent indicates test-first feature/bug work.
- Scope the rule to generic implementation contexts (not just one folder), with explicit triggers like "TDD", "red-green-refactor", "test-first", and bugfixes requesting safety via tests.
- Keep rule non-conflicting with existing targeted rules (fault/test catalog sync rules remain unchanged).

## Validation
- Verify the new skill appears in the skill inventory pattern already used in this workspace.
- Sanity-check markdown formatting and internal relative links (`tests.md`, `mocking.md`, etc.).
- Confirm rule wording is precise enough to activate intentionally but not over-trigger.

## Notes on source alignment
- Upstream reference used: [mattpocock/skills tdd](https://github.com/mattpocock/skills/tree/main/tdd)
- Intent is "as close as possible" while still being useful in this monorepo.
