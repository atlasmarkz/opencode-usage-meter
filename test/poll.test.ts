import { expect, test } from "bun:test"
import { createPoller } from "../src/poll"

test("skips while a run is pending", async () => {
  let calls = 0
  let release = () => {}
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const poll = createPoller(async () => {
    calls++
    await pending
  })

  const first = poll()
  await poll()
  expect(calls).toBe(1)

  release()
  await first
  await poll()
  expect(calls).toBe(2)
})

test("a failing run does not block the next run", async () => {
  let calls = 0
  const poll = createPoller(async () => {
    calls++
    if (calls === 1) throw new Error("boom")
  })

  await expect(poll()).rejects.toThrow("boom")
  await poll()
  expect(calls).toBe(2)
})
