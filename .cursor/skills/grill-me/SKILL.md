---
name: grill-me
description: Interview the user rigorously about a plan or design until shared understanding is reached by resolving each decision branch and dependency one-by-one. Use when the user asks to be grilled, says "grill me", wants a plan stress-test, or requests deep design interrogation during planning.
---

# Grill Me

## Mission
Drive the plan/design conversation to implementation-ready clarity by resolving the decision tree branch-by-branch.

## Operating Rules
- Ask exactly one question at a time.
- Include a recommended answer with every question.
- Prefer high-impact unresolved decisions before low-impact details.
- Track dependencies between decisions and revisit blocked branches after prerequisites are decided.
- If the question can be answered from the codebase, inspect the codebase first and present the finding instead of asking the user.
- Keep momentum: avoid broad multi-question dumps.

## Interview Loop
1. Restate the current plan/design hypothesis in 1-2 sentences.
2. Identify the next highest-impact unresolved decision.
3. Check if the answer is discoverable from the repo:
   - If yes, explore the codebase and report the result plus recommendation.
   - If no, ask one targeted question and include your recommended answer.
4. Wait for the user response before asking the next question.
5. Update your internal decision tree and repeat until all critical branches are resolved.

## Coverage Checklist
Ensure the interview eventually covers, when relevant:
- Scope and non-goals
- Constraints (time, risk, compatibility, performance)
- Data model and ownership
- API/contracts and integrations
- UX behavior and edge states
- Failure modes and rollback paths
- Testing strategy and acceptance criteria
- Rollout/migration sequencing
- Observability and monitoring
- Risks, assumptions, and open questions

## Exit Criteria
Stop grilling only when:
- Critical decisions and dependencies are resolved.
- Remaining assumptions are explicit and acknowledged.
- The final plan/design is concrete enough to implement without major ambiguity.
