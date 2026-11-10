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
