import { Show, createSignal, onCleanup } from "solid-js"
import { Plugin, Slot } from "@opencode/plugin/gui"
import { summarize, type UsageData } from "./usage"

const REFRESH_MS = 30_000

export default Plugin.define({
  i18n: {
    en: {
      label: "Go · 5h {{rolling}}% · wk {{weekly}}% · mo {{monthly}}%",
      loading: "Go usage…",
      none: "Go plan not active",
      failed: "Go usage unavailable",
    },
    "zh-Hans": {
      label: "Go · 5h {{rolling}}% · 周 {{weekly}}% · 月 {{monthly}}%",
      loading: "Go 用量加载中…",
      none: "未开通 Go 套餐",
      failed: "Go 用量获取失败",
    },
  },
  setup(ctx) {
    const [data, setData] = createSignal<UsageData | null>()
    const [state, setState] = createSignal("loading")

    const refresh = async () => {
      try {
        const result = await ctx.client.experimental.usage.limits()
        setData(result.data)
        setState(result.data ? "ok" : "null")
      } catch (cause) {
        setState(String(cause))
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    onCleanup(() => clearInterval(timer))

    const status = () => {
      const value = state()
      if (value === "loading") return ctx.t("loading")
      if (value === "null" || value === "ok") return ctx.t("none")
      return ctx.t("failed")
    }

    ctx.add(Slot, {
      at: "window.bottom",
      render: () => (
        <div style={{ display: "flex", "justify-content": "flex-end", width: "100%", "font-size": "11px" }}>
          <Show when={summarize(data())} keyed fallback={<span title={state()} style={{ opacity: 0.6 }}>{status()}</span>}>
            {(summary) => (
              <button
                type="button"
                title={ctx.t("label", summary)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0",
                  font: "inherit",
                  color: "inherit",
                  cursor: "pointer",
                  opacity: 0.75,
                }}
                onClick={() => ctx.system.openExternal(summary.usageURL)}
              >
                {ctx.t("label", summary)}
              </button>
            )}
          </Show>
        </div>
      ),
    })
  },
})
