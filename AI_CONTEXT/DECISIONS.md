# Decisions

Last updated: 2026-07-13

## Decision 1: Establish `AI_CONTEXT` As Project Knowledge Base

Decision: Create the required ADOS documentation files under `AI_CONTEXT` and treat them as the source of truth for future AI handoffs.

Reason: The user requested a self-documented, AI-independent development workflow. The repository did not previously contain `AI_CONTEXT`.

Alternatives Considered:

- Use only the existing codebase and chat history. Rejected because future assistants should not depend on prior chat history.
- Create a single documentation file. Rejected because the requested ADOS structure separates architecture, database, APIs, progress, TODOs, changelog, handoff, rules, and decisions.

Impact on the Project:

- Future tasks must begin by reading `AI_CONTEXT`.
- Documentation updates are required after code changes.
- Project knowledge is now easier to transfer between AI assistants and developers.

## Decision 2: Document Current Code Accurately Instead Of Correcting Runtime Bugs

Decision: Keep this initial task documentation-only and record discovered runtime issues as known risks and TODOs.

Reason: The user requested ADOS setup from the attached text. Changing runtime behavior while creating the documentation baseline would increase scope and risk.

Alternatives Considered:

- Fix all discovered bugs immediately. Rejected for this task because auth and role fixes require careful compatibility decisions.
- Ignore discovered bugs. Rejected because handoff documentation must accurately capture current project state.

Impact on the Project:

- The docs now identify high-priority stabilization work.
- Runtime behavior remains unchanged until a dedicated implementation task addresses those bugs.
