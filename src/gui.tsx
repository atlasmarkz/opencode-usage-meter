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
        console.warn("usage refresh failed", error)
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    onCleanup(() => clearInterval(timer))

    ctx.add(TitlebarItem, (): TitlebarItem | undefined => {
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
