# opencode-usage-meter — Design

**Date:** 2026-11-10
**Status:** Approved

## Intent

Show the OpenCode Go plan usage in the OpenCode Desktop window, in real time,
without leaving the app or supplying an API key.

## Goal

A GUI-only plugin that puts one usage pill in the window titlebar's top-right
plugin area. The icon is always visible; hovering expands the label with the
rolling (5-hour), weekly, and monthly percentages. Clicking opens the
workspace's Console usage page.

## Non-goals

- Volcengine Coding Plan, MiniMax, or any other plan (planned later).
- Console budget details (`data.budgets`).
- TUI version, settings page, history charts, notifications.
- A server part or any stored credential.

## Constraints

- OpenCode Desktop only (GUI plugin API, `@opencode/plugin/gui`).
- TitlebarItem labels are hidden until hover by the host; this is fixed
  platform behavior, not something the plugin can override per item.
- The data endpoint is the app's built-in
  `client.experimental.usage.limits()`; it returns `data: null` when the
  location is not signed in to a Console workspace.

## Approaches considered

- **A. TitlebarItem icon** — exact top-right position, icon-only at rest,
  hover expands the label. **Chosen.**
- **B. `session.header` slot text** — always-visible text, but in the
  conversation header instead of the window's outer corner.
- **C. Both** — redundant for a first version.

## Design

- Package `opencode-usage-meter`, GUI-only, no server part.
- On setup, fetch once and then every 30 seconds. Keep the last successful
  value when a refresh fails; render nothing until the first success.
- Render nothing when `data` is null or `data.go` is missing.
- Icon `window-analytics`; `warning` when any window reports `limited`.
- Label: `Go · 5h {r}% · 周 {w}% · 月 {m}%` for `zh-Hans`, with
  `5h / wk / mo` for English. `title` repeats the label for accessibility.
- Click: `ctx.system.openExternal(workspace.usageURL)`.
- Percentages are rounded and clamped to 0–100.
- Build with Vite's `@opencode/plugin/gui/vite` preset to a single
  `dist/gui-experimental.cjs`.
- Publish to npm with the `opencode-plugin` keyword so OpenDock indexes it;
  ship README and MIT license.

## What is left to the builder

- Exact Vite and package metadata details.
- Test names and assertions for the summarizer.
- Local install path and verification steps.
- README copy.

## Risks

- The GUI plugin API is marked experimental; a future Desktop release may
  change the registry or bundle format.
- OpenDock's listing appears on its next daily sync, not immediately.
