# Frontend stack for the redesigned portal

Status: proposal, 2026-10-30. Part of the [portal UX redesign](./README.md).

## Decision

Keep **React** and keep it a **Vite single-page app** served by the existing
portal server. Rebuild the view layer on a modern component foundation:

| Concern | Choice | Why |
|---|---|---|
| Framework | React 19 (already in use) | The shared controller, CodeMirror editor, Mermaid diagrams and canvas host all work in React today. Nothing in the redesign needs a different framework. |
| Build / dev | Vite 7 (already in use) | Instant HMR, the `/api` + WebSocket proxy to `:3001` already exists in `packages/app/web/vite.config.ts`. |
| Language | TypeScript for all new view code | Today the live UI is untyped JS (`web-app.js` alone is 16.5k lines). Types make the rebuild reviewable. |
| Styling | Tailwind CSS v4 with a CSS-variable token layer (`@theme`) | Tokens stay plain CSS custom properties, so the 20+ existing themes map onto them and the TUI keeps its own theme files. Tailwind replaces the 11k-line `index.css`. |
| Accessible primitives | React Aria Components (or Radix UI) | Menus, dialogs, comboboxes, tabs, tree views and grids with correct focus management and ARIA built in. The current UI hand-rolls these. |
| Routing | TanStack Router | Typed, URL-first routes (`/s/:sessionId`, `/s/:sessionId/canvas/:slot`, `/boards/:id`, `/providers`). React Router would also work; TanStack Router is chosen for typed search params. Replaces the custom view-history stack, and makes every view deep-linkable and back-button safe. |
| Server data | The shared controller for everything it already owns (sessions, transcripts, canvases, providers, packages); TanStack Query only for resources the controller does not hold (for example admin audit, knowledge, worker lists) | One owner per resource, never two caches for the same data. React reads the controller through `useSyncExternalStore`, which is safe under concurrent rendering. |
| Long lists | TanStack Virtual | Transcripts, logs and session lists with thousands of rows. |
| Panels | react-resizable-panels | Session/chat/inspector splits and Board (MoA) layouts with keyboard-resizable, persisted splits. |
| Command palette | cmdk | One `⌘K` entry point for every action, slash command and navigation target. |
| Icons | Lucide | One consistent outline set, every icon paired with a text label or tooltip. |
| Toasts | Sonner | Replaces ad-hoc status-line messages for async results. |
| Graphs | React Flow (`@xyflow/react`) for the agent tree / node map; keep Mermaid for sequence diagrams | Pan, zoom and select on the spawn tree. |
| Editor | Keep CodeMirror 6 | Already integrated for the Workspace file editor and diff view. |

## Why not Next.js

Next.js is a strong choice for content sites and apps that benefit from server
rendering. It could technically sit in front of the existing Express server
as a UI shell. It would still cost more than it returns here:

1. **It ships inside an npm package and runs on the customer's machine or cluster.**
   `pilotswarm-web` (`packages/app/web/bin/serve.js`) serves a prebuilt `dist/`
   from an Express server that also hosts the Web API and the WebSocket
   (`packages/app/web/server.js`). Next.js adds a second Node server runtime to
   package, start and secure, or a static export that gives up the features
   that justify it.
2. **Almost every screen is behind sign-in and live.** The only public page is
   the shared-canvas viewer, which is a small standalone host. There is no SEO
   surface, and data arrives over a WebSocket after authentication, so server
   components would mostly render loading states.
3. **Auth is a browser flow.** Entra sign-in uses MSAL in the browser and
   proxy-JWT on the server. Moving to Next.js middleware duplicates that.
4. **The shared controller is framework-free.** `packages/app/ui/core` drives
   both the TUI and the portal. A client-side React app consumes it directly; a
   server-rendered app would have to split it across the network boundary.
5. **Canvas apps run in sandboxed `blob:` iframes** (no `allow-same-origin`)
   that talk to the host over a frozen `postMessage` protocol, fed by a
   long-lived Postgres `LISTEN` relay and WebSocket in the Express server
   (`packages/app/web/api/canvas-plane.js`). The relay does not fit Next.js
   route handlers, and the iframe host works the same in any client framework.
   See [research/03-canvas.md](./research/03-canvas.md) §4.

Tailwind does not require Next.js. It is adopted here on its own merits. In
short: Vite fits the existing packaging, a client-heavy live interface, and
the lowest migration cost.

## The shared-core boundary

Reusing `ui/core` is realistic, but the line is not simply "keep the store,
replace the presentation selectors":

- **Some domain behaviour lives in selectors.** Pending and answered questions
  and warning reconciliation are worked out there (`selectors.js:2070` and
  around). Extract these into shared semantic projections first, so the TUI
  and the web compute them once.
- **Some selectors are already semantic.** `selectCanvasView` returns data the
  web can use directly.
- **The controller calls layout code.** It reaches into character-cell layout
  and transcript selectors (`controller.js:10181`). Those calls have to move
  behind a platform interface before the web stops publishing a fake terminal
  viewport.

Order of work: semantic projections → platform interface for layout → web
view-model selectors. Each step keeps `npm run test:tui` and
`npm run test:ui` green.

## Migration shape

Rebuild the view layer screen by screen behind a route switch, keeping
`ui/core` as the domain layer:

1. Add Tailwind v4, the token layer and primitives to `packages/app/web`; build
   the new app shell (navigation rail, command palette, routes) beside the
   current UI under `/next` (feature flag `portal.v2`).
2. Port screens on top of the `ui/core` store, reducer, controller and
   transport through small hooks (`useSessionList`, `useTranscript`,
   `useCanvasSlots`…), starting with one end-to-end slice (new session → chat →
   canvas, desktop and phone) as described in the README rollout. Do **not**
   reuse the `ui/core`
   presentation selectors for the web: they emit terminal-style colored text
   runs sized in character cells for the TUI
   ([research/02](./research/02-portal-ui-inventory.md) §3). Add web view-model
   selectors beside them instead, and leave the TUI's untouched.
   Delete the dead `web/src/**/*.tsx` tree (`main.tsx`, `App.tsx`,
   `components/**`, `hooks/*`), which is not loaded by `index.html`.
3. Split `ui/core/controller.js` (12k lines) in its own pull requests,
   separate from screen and canvas-host replacement, following the boundary
   above; keep the TUI green throughout (`npm run test:tui`, `npm run test:ui`).
4. Run the existing Playwright e2e suite against both shells; flip the default
   when parity is reached; delete the old `web-app.js` and `index.css`.
