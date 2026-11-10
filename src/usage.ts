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
