import { test, expect } from "@playwright/test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../.tmp-market-data/", import.meta.url));
const from = "2026-03-09T13:30:00.000Z";
const to = "2026-03-09T13:40:00.000Z";
async function select(page, label, name) {
  await page.getByRole("combobox", { name: new RegExp(`^${label}`) }).click();
  await page.getByRole("option", { name, exact: true }).click();
}
test("true replay preserves blind decisions, completed-bar visibility, controls, drawings, screenshots and owner isolation", async ({
  page,
  request,
}) => {
  const user = {
    email: `replay-${Date.now()}@example.test`,
    displayName: "Replay test",
    password: "replay-test-password-123",
  };
  expect(
    (await page.request.post("/api/auth/register", { data: user })).status(),
  ).toBe(201);
  const login = await page.request.post("/api/auth/login", {
    data: { email: user.email, password: user.password },
  });
  const owner = (await login.json()).user.id;
  const dir = path.join(root, owner);
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(
      path.join(dir, "manifest.json"),
      JSON.stringify({
        version: 1,
        datasets: [
          {
            id: "replay-fixture",
            symbol: "AAPL",
            timeframe: "1m",
            assetType: "equity",
            file: "candles.csv",
            timezone: "America/New_York",
            timestampFormat: "offset",
            timestampConvention: "start",
            priceBasis: "unadjusted",
            calendar: {
              from,
              to,
              timestampFormat: "offset",
              sessions: [
                {
                  kind: "rth",
                  tradingDate: "2026-03-09",
                  start: from,
                  end: to,
                },
              ],
            },
          },
        ],
      }),
    );
    // Artificial data solely for deterministic tests; never part of a live catalog.
    await writeFile(
      path.join(dir, "candles.csv"),
      "timestamp,open,high,low,close,volume\n" +
        Array.from(
          { length: 10 },
          (_, i) =>
            `${new Date(Date.parse(from) + i * 60000).toISOString()},${100 + i},${102 + i},${99 + i},${101 + i},100`,
        ).join("\n"),
    );
    const account = await (
      await page.request.post("/api/accounts", {
        data: { name: "Replay account" },
      })
    ).json();
    expect(
      (
        await page.request.post("/api/trades", {
          data: {
            accountId: account._id,
            symbol: "AAPL",
            direction: "long",
            quantity: 1,
            entryPrice: 100,
            exitPrice: 109,
            entryTime: from,
            exitTime: to,
            setup: "Historical setup secret",
            notes: "Historical note secret",
          },
        })
      ).status(),
    ).toBe(201);
    await page.goto("/replay");
    await select(page, "Historical dataset", "AAPL · 1m · replay-fixture");
    const createdResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/replay/runs") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Start replay", exact: true })
      .click();
    const created = await (await createdResponse).json();
    expect(created.candles).toEqual([]);
    expect(created.markers).toEqual([]);
    expect(created.comparison).toBeNull();
    expect(JSON.stringify(created)).not.toContain("Historical setup secret");
    await expect(page.getByTestId("replay-candle")).toHaveCount(0);
    await page
      .getByLabel("Reasoning", { exact: true })
      .fill("Wait for the first complete candle");
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(
      page.getByText("Wait for the first complete candle", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Step one bar" }).click();
    await expect(page.getByTestId("replay-candle")).toHaveCount(1);
    const first = await (
      await page.request.get(`/api/replay/runs/${created.id}`)
    ).json();
    expect(first.timestamp).toBe("2026-03-09T13:31:00.000Z");
    expect(first.candles).toHaveLength(1);
    expect(first.events[0]).toMatchObject({
      action: "Wait",
      cursor: -1,
      timestamp: from,
      afterExposure: false,
    });
    await page
      .getByLabel("Replay note / strategy / setup")
      .fill("Observe the opening range");
    await page.getByRole("button", { name: "Save replay note" }).click();
    await expect(
      page.getByText("Observe the opening range", { exact: true }),
    ).toBeVisible();
    await select(page, "Drawing tool", "Stop line");
    await page.getByLabel("Line price", { exact: true }).fill("99");
    await page.getByRole("button", { name: "Add line at price" }).click();
    await expect(page.getByText("stop @ 99:", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save chart screenshot" }).click();
    await expect(
      page.getByRole("img", { name: /Replay chart at/ }),
    ).toBeVisible();
    const saved = await (
      await page.request.get(`/api/replay/runs/${created.id}`)
    ).json();
    expect((await page.request.get(saved.screenshots[0].url)).status()).toBe(
      200,
    );
    expect((await request.get(saved.screenshots[0].url)).status()).toBe(401);
    await page.getByRole("button", { name: "Advance 5", exact: true }).click();
    await expect(page.getByTestId("replay-candle")).toHaveCount(6);
    await select(page, "Playback speed", "0.5×");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByTestId("replay-candle")).toHaveCount(6);
    await select(page, "Playback speed", "4×");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByTestId("replay-candle")).toHaveCount(10);
    await expect(
      page.getByRole("button", { name: "Play", exact: true }),
    ).toBeDisabled();
    await expect(page.getByTestId("replay-marker")).toHaveCount(0);
    await page.getByRole("button", { name: "Reveal original trades" }).click();
    await expect(
      page.getByText("Historical comparison", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Historical note secret", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("replay-marker")).toHaveCount(2);
    const timeline = page.getByRole("slider", { name: "Replay timeline" });
    await timeline.focus();
    await timeline.press("Home");
    await expect(page.getByTestId("replay-candle")).toHaveCount(0);
    await expect(
      page.getByText("Historical comparison", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("img", { name: /Replay chart at/ }),
    ).toHaveCount(0);
    expect((await page.request.get(saved.screenshots[0].url)).status()).toBe(
      404,
    );
    await page.reload();
    await select(page, "Resume saved replay", "AAPL 1m replay · blind");
    await expect(
      page.getByText("Wait for the first complete candle", { exact: true }),
    ).toBeVisible();
    for (const mode of ["light", "dark"]) {
      await page.evaluate(
        (value) => localStorage.setItem("tortoise-scroll-theme", value),
        mode,
      );
      await page.setViewportSize({
        width: mode === "light" ? 1280 : 390,
        height: 900,
      });
      await page.reload();
      await select(page, "Resume saved replay", "AAPL 1m replay · blind");
      await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
      await expect(
        page.getByRole("button", { name: "Step one bar" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("button", { name: "Advance 5", exact: true }).click();
    await expect(page.getByTestId("replay-candle")).toHaveCount(5);
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: "/tmp/tortoise-replay-mobile.png",
      fullPage: true,
    });
    const foreign = {
      email: `replay-other-${Date.now()}@example.test`,
      displayName: "Other",
      password: user.password,
    };
    await request.post("/api/auth/register", { data: foreign });
    await request.post("/api/auth/login", {
      data: { email: foreign.email, password: foreign.password },
    });
    expect(
      (
        await request.get(`/api/replay/runs/${created.id}?userId=${owner}`)
      ).status(),
    ).toBe(404);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(
      fileURLToPath(
        new URL(`../../server/uploads/replay/${owner}`, import.meta.url),
      ),
      { recursive: true, force: true },
    );
  }
});
