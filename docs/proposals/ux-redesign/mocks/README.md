# Prototype

`index.html` is a self-contained, clickable prototype of the redesigned
portal in the Flight Deck design system. Open it in a browser; no build or
server is needed. All data is made up for the demo.

- Navigate with the rail (bottom tab bar on phones), `⌘K` / `Ctrl+K` for the
  command palette, `N` for a new session, `Esc` to close overlays.
- The sun icon in the top bar switches light and dark; Settings → Appearance
  shows the theme picker.
- Session screens worth opening: **Release readiness 0.8.8** (canvas,
  sub-agents, files, delegation, activity timeline), **Investigate p95 spike on chk** (an
  agent question answered from chat), **Weekly dependency bumps** (a
  structured error; the side pane stays closed until you pick a view).

## Screenshots

Desktop 1440×900, dark unless noted. Regenerate with Playwright from the
prototype if it changes.

| File | Shows |
|---|---|
| `screens/dark-01-home.png` | Home: Needs you, Running, Scheduled and waiting, Recent outputs |
| `screens/dark-02-sessions.png` | Sessions: groups, pinned, sub-agents nested, state + reason, durable spine |
| `screens/dark-03-session-canvas.png` | Session: chat beside the canvas, canvas tabs, sandboxed badge |
| `screens/dark-04-session-files.png` | Session → Files → Folders with git changes and a diff |
| `screens/dark-05-session-delegation.png` | Session → Delegation: sub-agent tree and in-session task with a legend |
| `screens/dark-06-session-activity.png` | Session → Activity: question chips, "why it waits", timeline, logs |
| `screens/dark-07-needs-you-question.png` | An agent question with its choices as buttons |
| `screens/dark-08-structured-error.png` | A failed turn as a structured error with fixes |
| `screens/dark-09-new-session.png` | New session: prompt, agent, collapsed options |
| `screens/dark-10-command-palette.png` | Command palette |
| `screens/dark-11-session-menu.png` | Session ⋯ menu with the danger section and cascade note |
| `screens/dark-12-share-canvas.png` | Share canvas: link audience and edit permission separated |
| `screens/dark-13-boards.png` | Boards (was Master of Agents): canvas and chat tiles |
| `screens/dark-14-outputs.png` | Outputs: canvases and files across sessions |
| `screens/dark-15-agent-library.png` | Agent library: start a session from an agent |
| `screens/dark-16-providers.png` | Providers: keys, status, token use against limits, allowance and hold |
| `screens/dark-17-admin.png` | Admin → Feature flags |
| `screens/dark-18-settings.png` | Settings → Appearance |
| `screens/light-*.png` | The same key screens in the light theme |
| `screens/phone-*.png` | Phone 390×844: Home, Sessions, session chat and canvas, a question, new session |

Screenshots of today's portal, for comparison, are in
[../research/screens/](../research/screens/).
