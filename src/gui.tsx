import { Show, createSignal, onCleanup } from "solid-js"
import { Plugin, Slot } from "@opencode/plugin/gui"
import { summarize, type UsageData } from "./usage"
import { createPoller } from "./poll"

const REFRESH_MS = 30_000

type State = "loading" | "signedOut" | "noPlan" | "failed"

export default Plugin.define({
  i18n: {
    en: {
      label: "Go · 5h {{rolling}}% · wk {{weekly}}% · mo {{monthly}}%",
      limited: "Go · 5h {{rolling}}% · wk {{weekly}}% · mo {{monthly}}% · limited",
      loading: "Go usage…",
      signedOut: "Sign in to OpenCode Console for Go usage",
      noPlan: "Go plan not active",
      failed: "Go usage unavailable",
      stale: "stale",
    },
    "zh-Hans": {
      label: "Go · 5h {{rolling}}% · 周 {{weekly}}% · 月 {{monthly}}%",
      limited: "Go · 5h {{rolling}}% · 周 {{weekly}}% · 月 {{monthly}}% · 已受限",
      loading: "Go 用量加载中…",
      signedOut: "登录 OpenCode Console 后显示 Go 用量",
      noPlan: "未开通 Go 套餐",
      failed: "Go 用量获取失败",
      stale: "获取失败",
    },
  },
  setup(ctx) {
    const [data, setData] = createSignal<UsageData | null>()
    const [state, setState] = createSignal<State>("loading")
    const [error, setError] = createSignal("")

    let lastError = ""

    const refresh = createPoller(async () => {
      try {
        const result = await ctx.client.experimental.usage.limits(undefined, { signal: ctx.signal })
        if (ctx.signal.aborted) return
        setData(result.data)
        setState(result.data ? "noPlan" : "signedOut")
        setError("")
        lastError = ""
      } catch (cause) {
        if (ctx.signal.aborted) return
        const message = String(cause)
        if (message !== lastError) console.warn("[usage-meter]", cause)
        lastError = message
        setError(message)
        setState("failed")
      }
    })

    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    onCleanup(() => clearInterval(timer))

    const message = { loading: "loading", signedOut: "signedOut", noPlan: "noPlan", failed: "failed" } as const
    const status = () => ctx.t(message[state()])

    ctx.add(Slot, {
      at: "window.bottom",
      render: () => (
        <div style={{ display: "flex", "justify-content": "flex-end", width: "100%", "font-size": "11px" }}>
          <Show
            when={summarize(data())}
            fallback={<span title={state() === "failed" ? error() : undefined}>{status()}</span>}
          >
            {(summary) => {
              const labelText = () => ctx.t(summary().limited ? "limited" : "label", summary())
              return (
                <button
                  type="button"
                  title={state() === "failed" ? error() : labelText()}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "0 4px",
                    font: "inherit",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                  onClick={() => ctx.system.openExternal(summary().usageURL)}
                >
                  {state() === "failed" ? `${labelText()} · ${ctx.t("stale")}` : labelText()}
                </button>
              )
            }}
          </Show>
        </div>
      ),
    })
  },
})
