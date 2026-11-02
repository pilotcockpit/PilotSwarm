# PilotSwarm — agent project instructions (Codex, Claude Code, Grok)

This file is read by every agent host. Rules that name a specific host say so; anything else applies to all of them.

## Start here

1. Run `python3 ~/.agent-skills/scripts/agent_policy.py context --cwd "$PWD"`
   and read the shared owner policy and applicable sources it resolves. Keep
   owner-wide rules in that canonical source rather than copying them here.
2. Read [the shared repository instructions](.github/copilot-instructions.md)
   in full before making changes. They apply to Codex, Claude Code and Grok as well as Copilot;
   preserve their architecture, privacy, replay-safety and verification rules.
   Owner policy and its resolved domain authorities take precedence over
   conflicting repository recipes.
3. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the relevant guide under
   [docs/](docs/README.md). Use manifests and scripts for current commands and
   versions; some older documentation still describes the pre-monorepo layout.

## Working agreement

- Work directly on `dev`. Keep one local branch and this checkout; create
  additional branches or worktrees only when the user explicitly requests them.
- Inspect `git status`, the index and worktree list before editing. Preserve
  other sessions' work and stage only changes included in the authorized task.
- Follow the user's current commit/push authorization. Before committing, get an
  independent review from a reviewer other than the host that wrote the change,
  and resolve actionable findings. Which one depends on the host (owner policy,
  "Models and independent reviews", is the authority; resolve model and effort
  there, never from this file):
  - Claude Code–led work: Codex, run read-only through `codex exec` as
    `~/.agent-skills/policies/codex-exec.md` describes. Do not run the Claude
    review skill: reviewing Claude's work with Claude is not independent, and a
    logged-out or failing Claude CLI is not a blocker for Claude-led work.
  - Codex- or Grok-led work: the shared Claude review skill, through
    `~/.agent-skills/claude/review.sh start` and `poll` only.
  A failed, empty or unfinished review is not an approval; say so and do not
  report the change as reviewed.
- Keep changes within PilotSwarm; downstream consumers require separate scope.

## Repository map

- `packages/sdk/`: TypeScript durable runtime, clients, workers, orchestration,
  CMS, model providers and embedded plugins.
- `packages/app/tui/`: terminal host and CLI.
- `packages/app/web/`: browser portal and Web API.
- `packages/app/ui/core/` and `packages/app/ui/react/`: shared UI behavior and
  rendering; keep terminal and portal behavior aligned.
- `packages/app/mcp/`: MCP server layered on the management/client APIs.
- `packages/horizon-store/`: optional facts and graph provider.
- `templates/builder-agents/`: distributable templates, not active repo agents.

For orchestration changes, read
[the versioning skill](.agents/skills/duroxide-orchestration-versioning/SKILL.md)
before editing. Preserve frozen handlers and deterministic replay.

For infrastructure or database changes, load the domain authority returned by
the policy resolver first. For deployment/release tasks, also read
[deployment routing](.github/DEPLOYMENT.md); managed environment mutations use
GitHub Actions.

## Setup and verification

This is an npm workspace with `package-lock.json`. Read root and affected
workspace `package.json` files for Node requirements and available scripts.
Use `npm ci` for a fresh install and `npm run build` for the workspace build.
Preserve existing private environment and model-provider configuration.

Select checks for the changed surface:

| Surface | Command from repo root |
| --- | --- |
| SDK types | `npm run lint` |
| SDK unit tests | `npm run test:unit --workspace=pilotswarm-sdk` |
| SDK Web API client | `npm run test:api --workspace=pilotswarm-sdk` |
| Terminal UI | `npm run test:tui --workspace=pilotswarm` |
| Portal | `npm run test:web --workspace=pilotswarm` |
| Shared UI | `npm run test:ui --workspace=pilotswarm` |
| MCP unit tests | `npm run test:mcp-server` |

Read [local test setup](docs/developer/contributing/local-ci-and-tests.md)
before integration tests. `npm test`, `npm run test:local` and
`./scripts/run-tests.sh` can use real databases and model providers; inspect
their scope and obtain any missing spending authorization before running them.
Never point the test harness at a portal or production database. The owner
policy's prohibition on live paid Gemini/Google generative calls also applies
to tests and reviews.

After staging, run `npm run check:privacy` and `git diff --cached --check`.
The privacy guard scans the index, so an unstaged file is not covered. For
documentation-only changes, verify referenced paths and commands; runtime
tests are needed when runtime behavior changes. Report the checks actually
run and any remaining verification limits.
