import { Show, createSignal, onCleanup } from "solid-js"
import { Plugin, Slot } from "@opencode/plugin/gui"
import { summarize, type UsageData } from "./usage"

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
    },
    "zh-Hans": {
      label: "Go · 5h {{rolling}}% · 周 {{weekly}}% · 月 {{monthly}}%",
      limited: "Go · 5h {{rolling}}% · 周 {{weekly}}% · 月 {{monthly}}% · 已受限",
      loading: "Go 用量加载中…",
      signedOut: "登录 OpenCode Console 后显示 Go 用量",
      noPlan: "未开通 Go 套餐",
      failed: "Go 用量获取失败",
    },
  },
  setup(ctx) {
    const [data, setData] = createSignal<UsageData | null>()
    const [state, setState] = createSignal<State>("loading")
    const [error, setError] = createSignal("")

    const refresh = async () => {
      try {
        const result = await ctx.client.experimental.usage.limits()
        setData(result.data)
        setState(result.data ? "noPlan" : "signedOut")
        setError("")
      } catch (cause) {
        console.warn("[usage-meter]", cause)
        setError(String(cause))
        setState("failed")
      }
    }

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
            fallback={<span title={state() === "failed" ? error() : undefined} style={{ opacity: 0.6 }}>{status()}</span>}
          >
            {(summary) => (
              <button
                type="button"
                title={ctx.t(summary().limited ? "limited" : "label", summary())}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0",
                  font: "inherit",
                  color: "inherit",
                  cursor: "pointer",
                  opacity: 0.75,
                }}
                onClick={() => ctx.system.openExternal(summary().usageURL)}
              >
                {ctx.t(summary().limited ? "limited" : "label", summary())}
              </button>
            )}
          </Show>
        </div>
      ),
    })
  },
})
