# PilotSwarm: instructions for coding agents and contributors

This file is read by AI coding agents and is a short orientation for people. It adds nothing that
[CONTRIBUTING.md](CONTRIBUTING.md) does not already require.

## Start here

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the guide in [docs/](docs/README.md) for the area you are changing.
2. Read [the shared repository instructions](.github/copilot-instructions.md) in full before making changes; they apply
   to every coding agent, not only Copilot. Preserve their architecture, privacy, replay-safety and verification rules.
3. Use the manifests and scripts for current commands and versions; some older documentation still describes the
   pre-monorepo layout.

## Working agreement

- Look at `git status` and the staged changes before editing, and keep unrelated changes out of yours.
- Commit and push only when the person you are working with asks you to.
- Review the change with someone or something other than its author before it is committed, and fix what the review
  finds. A review that failed, returned nothing or did not finish is not an approval; say so.
- Keep changes within PilotSwarm; downstream consumers need separate scope.

## Repository map

- `packages/sdk/`: TypeScript durable runtime, clients, workers, orchestration, CMS, model providers and embedded plugins.
- `packages/app/tui/`: terminal host and CLI.
- `packages/app/web/`: browser portal and Web API.
- `packages/app/ui/core/` and `packages/app/ui/react/`: shared UI behavior and rendering; keep terminal and portal
  behavior aligned.
- `packages/app/mcp/`: MCP server layered on the management and client APIs.
- `packages/flightdeck/`: Flight Deck, the redesigned browser dashboard over the same Web API (its own README, design
  system and open items).
- `packages/horizon-store/`: optional facts and graph provider.
- `templates/builder-agents/`: distributable templates, not active repo agents.

For orchestration changes, read [the versioning skill](.agents/skills/duroxide-orchestration-versioning/SKILL.md) before
editing. Preserve frozen handlers and deterministic replay. For deployment and release tasks, read
[deployment routing](.github/DEPLOYMENT.md); managed environment changes go through GitHub Actions.

## Setup and verification

This is an npm workspace with `package-lock.json`. Read the root and affected workspace `package.json` files for Node
requirements and scripts. Use `npm ci` for a fresh install and `npm run build` for the workspace build. Keep existing
environment and model-provider configuration intact.

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
| Flight Deck build and unit tests | `npm run build:flightdeck` and `npm run test:flightdeck` |
| Flight Deck browser tests | `npm run test:flightdeck:e2e` (about four minutes, local) |

Read [local test setup](docs/developer/contributing/local-ci-and-tests.md) before integration tests. `npm test`,
`npm run test:local` and `./scripts/run-tests.sh` can use real databases and model providers: check what they touch
and get approval for any spend first. Never point the test harness at a portal or production database.

After staging, run `npm run check:privacy` and `git diff --cached --check`. The privacy guard scans the index, so an
unstaged file is not covered. For documentation-only changes, verify the paths and commands you reference; runtime
tests are needed when runtime behavior changes. Report the checks you ran and what remains unverified.
