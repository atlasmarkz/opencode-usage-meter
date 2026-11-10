# opencode-usage-meter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A GUI-only OpenCode Desktop plugin that shows OpenCode Go usage in the bottom status bar and publishes to npm/OpenDock.

**Architecture:** One pure function turns the app's usage response into a display summary. A Solid GUI plugin polls `ctx.client.experimental.usage.limits()` every 30 seconds and contributes one `window.bottom` slot.

> **Execution deviation (2026-11-10):** Tasks 1–2 implemented a `TitlebarItem`
> pill. After live use the user asked for the existing bottom status bar
> instead, so `src/gui.tsx` now contributes a `Slot` at `window.bottom` with
> always-visible text. The spec has been updated; the code snippets in Task 2
> below are historical. Also learned: `Slot.render` runs once per mount, so
> the conditional must use Solid `Show` (or another reactive primitive), not
> a plain `summary ? … : …` evaluated inside `render`.

**Tech Stack:** TypeScript, Solid, Vite (`@opencode/plugin/gui/vite`), Bun test.

**Spec:** `docs/superpowers/specs/2026-11-10-opencode-usage-meter-design.md`

## Global Constraints

- Package name `opencode-usage-meter`, version `0.1.0`, MIT.
- GUI-only: no server part, no credentials, no new runtime dependency besides `@opencode/plugin`.
- Works with OpenCode Desktop 2.2.6; `@opencode/plugin` pinned to `2.2.6`.
- npm keyword `opencode-plugin` is required for OpenDock indexing.
- Titlebar labels were hidden until hover; the final surface is the
  always-visible `window.bottom` slot instead.
- Percentages shown are 0–100 integers.
- No Volcengine, MiniMax, budgets, TUI, settings page, or history.

## Review Focus

- Console not signed in (`data: null`): show the muted sign-in status line, no button.
- Go allowance absent at runtime: show the muted "plan not active" line, no button.
- Endpoint fails or server restarts: keep the last good value; never throw an unhandled rejection.
- Fractional or out-of-range percentages: round and clamp to 0–100.
- Plugin reload or window close: clear the interval and withdraw the item; no duplicates.
- Active locale is not `zh-Hans`: the English label must render.

---

### Task 1: Scaffold and usage summarizer

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `LICENSE`
- Create: `src/usage.ts`
- Test: `test/usage.test.ts`

**Interfaces:**
- Produces:
  - `type Meter = { percent: number; limited: boolean; resetsAt: number }`
  - `type UsageData = { workspace: { id: string; name?: string; usageURL: string }; go?: { rolling: Meter; weekly: Meter; monthly: Meter }; budgets?: unknown[] }`
  - `type Summary = { rolling: number; weekly: number; monthly: number; limited: boolean; usageURL: string }`
  - `summarize(data: UsageData | null | undefined): Summary | undefined`

- [ ] **Step 1: Initialize the repo and manifest**

Run:

```bash
mkdir -p /Users/mark/Code/opencode-usage-meter/src /Users/mark/Code/opencode-usage-meter/test
cd /Users/mark/Code/opencode-usage-meter
git init
```

Create `package.json`:

```json
{
  "name": "opencode-usage-meter",
  "version": "0.1.0",
  "description": "Coding plan usage meter in the OpenCode Desktop titlebar",
  "type": "module",
  "license": "MIT",
  "author": "AMark-CS",
  "keywords": ["opencode", "opencode-plugin", "usage", "quota", "opencode-go"],
  "exports": { "./gui-experimental": "./dist/gui-experimental.cjs" },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "vite build",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@opencode/plugin": "2.2.6"
  },
  "devDependencies": {
    "@types/bun": "^1.2.0",
    "solid-js": "^1.9.0",
    "typescript": "^5.9.0",
    "vite": "^7.0.0",
    "vite-plugin-solid": "^2.11.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["bun"]
  },
  "include": ["src", "test"]
}
```

Create `.gitignore`:

```
node_modules
.DS_Store
```

Create `LICENSE` with the MIT license text, copyright `2026 AMark-CS`.

Run `npm install`.

- [ ] **Step 2: Write the failing test**

Create `test/usage.test.ts`:

```ts
import { describe, expect, test } from "bun:test"
import { summarize, type UsageData } from "../src/usage"

const meter = (percent: number, limited = false) => ({ percent, limited, resetsAt: 0 })

function data(overrides: Partial<UsageData> = {}): UsageData {
  return {
    workspace: { id: "wrk_1", usageURL: "https://opencode.ai/console/wrk_1/activity/overview" },
    go: { rolling: meter(2), weekly: meter(0), monthly: meter(0) },
    ...overrides,
  }
}

describe("summarize", () => {
  test("returns undefined when not signed in", () => {
    expect(summarize(null)).toBeUndefined()
    expect(summarize(undefined)).toBeUndefined()
  })

  test("returns undefined without a Go allowance", () => {
    expect(summarize(data({ go: undefined }))).toBeUndefined()
  })

  test("maps all three windows", () => {
    expect(summarize(data())).toEqual({
      rolling: 2,
      weekly: 0,
      monthly: 0,
      limited: false,
      usageURL: "https://opencode.ai/console/wrk_1/activity/overview",
    })
  })

  test("is limited when any window is limited", () => {
    const summary = summarize(
      data({ go: { rolling: meter(10), weekly: meter(100, true), monthly: meter(10) } }),
    )
    expect(summary?.limited).toBe(true)
  })

  test("rounds and clamps percentages", () => {
    const summary = summarize(
      data({ go: { rolling: meter(2.6), weekly: meter(-1), monthly: meter(140) } }),
    )
    expect([summary?.rolling, summary?.weekly, summary?.monthly]).toEqual([3, 0, 100])
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test`

Expected: FAIL because `../src/usage` does not exist.

- [ ] **Step 4: Implement `src/usage.ts`**

```ts
export type Meter = { percent: number; limited: boolean; resetsAt: number }

export type UsageData = {
  workspace: { id: string; name?: string; usageURL: string }
  go?: { rolling: Meter; weekly: Meter; monthly: Meter }
  budgets?: unknown[]
}

export type Summary = {
  rolling: number
  weekly: number
  monthly: number
  limited: boolean
  usageURL: string
}

const clamp = (meter: Meter) => Math.max(0, Math.min(100, Math.round(meter.percent)))

export function summarize(data: UsageData | null | undefined): Summary | undefined {
  if (!data?.go) return undefined
  const { rolling, weekly, monthly } = data.go
  return {
    rolling: clamp(rolling),
    weekly: clamp(weekly),
    monthly: clamp(monthly),
    limited: rolling.limited || weekly.limited || monthly.limited,
    usageURL: data.workspace.usageURL,
  }
}
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `bun test`

Expected: 5 passing tests.

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore LICENSE src/usage.ts test/usage.test.ts
git commit -m "feat: summarize OpenCode Go usage"
```

---

### Task 2: GUI plugin and bundle

**Files:**
- Create: `src/gui.tsx`, `vite.config.ts`
- Modify: `tsconfig.json` (add `vite.config.ts` to `include`)

**Interfaces:**
- Consumes: `summarize`, `UsageData` from `./usage`.
- Produces: default export `Plugin.define(...)` and `dist/gui-experimental.cjs`.

- [ ] **Step 1: Write the GUI plugin**

Create `src/gui.tsx`:

```tsx
import { createSignal, onCleanup } from "solid-js"
import { Plugin, TitlebarItem } from "@opencode/plugin/gui"
import { summarize, type UsageData } from "./usage"

const REFRESH_MS = 30_000

export default Plugin.define({
  i18n: {
    en: { label: "Go · 5h {{rolling}}% · wk {{weekly}}% · mo {{monthly}}%" },
    "zh-Hans": { label: "Go · 5h {{rolling}}% · 周 {{weekly}}% · 月 {{monthly}}%" },
  },
  setup(ctx) {
    const [data, setData] = createSignal<UsageData | null>()
    let reported = false

    const refresh = async () => {
      try {
        const result = await ctx.client.experimental.usage.limits()
        setData(result.data)
      } catch (error) {
        if (reported) return
        reported = true
        ctx.log.write("warn", "usage refresh failed", { error: String(error) })
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    onCleanup(() => clearInterval(timer))

    ctx.add(TitlebarItem, () => {
      const summary = summarize(data())
      if (!summary) return undefined
      const label = ctx.t("label", summary)
      return {
        id: "meter",
        label,
        title: label,
        icon: summary.limited ? "warning" : "window-analytics",
        run: () => ctx.system.openExternal(summary.usageURL),
      }
    })
  },
})
```

- [ ] **Step 2: Write the Vite config**

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite"
import { gui } from "@opencode/plugin/gui/vite"

export default defineConfig({ plugins: [gui()] })
```

Add `"vite.config.ts"` to the `include` array in `tsconfig.json`.

- [ ] **Step 3: Build and typecheck**

Run: `npm run build`

Expected: `dist/gui-experimental.cjs` exists and is the only output file.

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/gui.tsx vite.config.ts tsconfig.json dist/gui-experimental.cjs
git commit -m "feat: add titlebar usage meter"
```

---

### Task 3: Local install and live verification

**Files:**
- Modify: `~/.config/opencode/opencode.json` (outside the repo; preserve every other field)

**Interfaces:**
- Consumes: the running desktop server and the built `dist/gui-experimental.cjs`.

- [ ] **Step 1: Back up the global config**

Run: `cp ~/.config/opencode/opencode.json ~/.config/opencode/opencode.json.bak`

- [ ] **Step 2: Add the local plugin directory**

Append `"/Users/mark/Code/opencode-usage-meter"` to the existing `plugin` array. Keep the V1 `plugin` key the file already uses; do not reformat the file.

The config hot-reloads; do not restart OpenCode.

- [ ] **Step 3: Check for load errors**

Run:

```bash
grep -ri "opencode-usage-meter" ~/Library/Logs ~/.local/share/opencode/log 2>/dev/null | tail -20
```

Expected: no load/parse errors. If the log path is not present, locate the desktop log with `ls ~/Library/Logs | grep -i opencode`.

- [ ] **Step 4: Verify the line renders**

Ask the user to look at the bottom status bar (screen capture is blocked by
macOS TCC in this environment). Expected: `Go · 5h …% · 周 …% · 月 …%`
right-aligned, or a muted status line when the API returns null.

- [ ] **Step 5: Verify the numbers against the API**

Run:

```bash
/Users/mark/Library/Application\ Support/ai.opencode.desktop/cli/2.2.6-arm64/opencode-cli api get /api/experimental/usage/limits
```

Confirm `5h / 周 / 月` match `go.rolling.percent / weekly.percent / monthly.percent`. Click the line and confirm the Console usage page opens.

- [ ] **Step 6: Commit any fixes**

If verification required code changes, rebuild and commit them. Otherwise this task adds no repo files.

---

### Task 4: README, repository, publish

**Files:**
- Create: `README.md`, `docs/screenshot.png`
- Modify: `package.json` (repository, homepage, bugs)

- [ ] **Step 1: Write the README**

Include:

- One-line description and the screenshot.
- Install: add `"opencode-usage-meter"` to `plugins` in the global `opencode.json(c)` (or the existing `plugin` array), then let Desktop reload.
- What it shows: rolling 5-hour, weekly, monthly percentages; hover label; click opens Console.
- Requirements: OpenCode Desktop, OpenCode Go subscription.
- Development: `npm install`, `npm run build`, `bun test`, local plugin path.
- License: MIT.
- Roadmap: other coding plans, no promises.

- [ ] **Step 2: Capture the README screenshot**

Ask the user to hover the pill, then run `screencapture -x docs/screenshot.png`. If hovering is not possible, capture the icon at rest and say "hover to see values" in the README.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/screenshot.png
git commit -m "docs: add README and screenshot"
```

- [ ] **Step 4: Create the GitHub repository**

Run:

```bash
gh repo view AMark-CS/opencode-usage-meter >/dev/null 2>&1 || \
  gh repo create AMark-CS/opencode-usage-meter --public --source=. --remote=origin
git push -u origin HEAD
```

Add to `package.json`:

```json
"repository": { "type": "git", "url": "git+https://github.com/AMark-CS/opencode-usage-meter.git" },
"homepage": "https://github.com/AMark-CS/opencode-usage-meter#readme",
"bugs": { "url": "https://github.com/AMark-CS/opencode-usage-meter/issues" }
```

Commit and push.

- [ ] **Step 5: Publish to npm**

Run: `npm publish --access public`

Expected: `+ opencode-usage-meter@0.1.0`.

Run: `npm view opencode-usage-meter version keywords repository`

Expected: version `0.1.0` and keyword `opencode-plugin` present.

- [ ] **Step 6: Test the published package**

Replace the local directory path in `~/.config/opencode/opencode.json` with `"opencode-usage-meter"`. Wait for the reload, then repeat the screenshot and API comparison from Task 3. If the published package does not load, restore the local path and report the failure instead of claiming success.

- [ ] **Step 7: OpenDock**

No manual submission is required. Note in the final report that OpenDock's next daily sync (03:00 UTC) indexes the package by its `opencode-plugin` keyword.
