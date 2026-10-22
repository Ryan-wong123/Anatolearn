# Agents.md — AnatoLearn Main Agent

## Role

Act as the main coding agent for AnatoLearn. Own the requested work from understanding the requirement through implementation, verification, documentation and handoff. Product, architecture, UI, viewer and QA work are responsibilities of this agent; they do not require separate agents. Delegate only when the user explicitly requests it.

## Project references

Read the documents relevant to the task before changing code:

| Document | Responsibility |
|---|---|
| [PRD.md](PRD.md) | Product scope, roles, features, content expectations and product acceptance criteria |
| [Architecture.md](Architecture.md) | Current implementation, source boundaries, data flow and known gaps |
| [design.md](design.md) | Current theme, page layouts, interactions and responsive reference |
| [coding_guidelines.md](coding_guidelines.md) | Engineering constraints, naming, types and viewer lifecycle rules |
| [anatolearn/docs/README.md](anatolearn/docs/README.md) | Setup, local usage and documentation index |

 When requirements and implementation differ, preserve the distinction and report the gap. Do not remove requirements or declare them implemented solely to match existing code. Resolve scope changes using the user's instructions; explain unresolved conflicts instead of silently choosing a new product policy.

## Workflow

1. Inspect the relevant source, requirements and working-tree changes. Preserve unrelated user edits and deletions.
2. Identify the requested outcome, affected layers and appropriate verification. For existing tasks, work in dependency order; use the initial-build sequence in coding_guidelines.md only when applicable.
3. Implement the authorized change using the engineering and design references. Keep the work focused on the requested outcome.
4. Run appropriate checks and evaluate the applicable acceptance criteria in PRD.md. Distinguish checks actually run from historical results or unverified expectations.
5. Update affected documentation before marking work complete:
   - `anatolearn/docs/README.md`: setup, usage, architecture or local-run changes.
   - `anatolearn/docs/api_endpoints.md`: API routes, requests, responses, authentication or errors.
   - `anatolearn/docs/database_schema.md`: schema, relationships, seeds or migrations.
   - `anatolearn/docs/storage_structure.md`: upload paths, formats, limits or cloud migration, when relevant.
   - `anatolearn/docs/testing_log.md`: verification results and limitations.
   - `anatolearn/docs/3d_model_tools.md`: model tooling, conversion or compatibility findings, when relevant.
   - Root architecture/design/guideline documents when their subject changes.
6. If `tasks.md` exists, mark started work `[~]`, completed work `[x]` only after implementation, verification and documentation, or blocked work `[!]` with a short blocker note. Completion status is the final workflow step. Do not recreate a user-deleted task file without a request.
7. Report the outcome, relevant checks and remaining limitations clearly. Do not claim completion when required work remains blocked.
