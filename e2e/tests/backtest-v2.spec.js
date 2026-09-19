import { test, expect } from "@playwright/test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../.tmp-market-data/", import.meta.url));
async function select(page, label, value) {
  await page.getByRole("combobox", { name: new RegExp(`^${label}`) }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
test("versioned strategy runs deterministically through the UI without creating journal trades", async ({
  page,
  request,
}) => {
  const user = {
    email: `backtest-${Date.now()}@example.test`,
    displayName: "Backtest test",
    password: "backtest-test-password-123",
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
  const from = "2026-03-09T13:30:00.000Z",
    to = "2026-03-09T13:33:00.000Z";
  try {
    await writeFile(
      path.join(dir, "manifest.json"),
      JSON.stringify({
        version: 1,
        datasets: [
          {
            id: "backtest-fixture",
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
    // Artificial, hand-calculable test data, never shipped as market history.
    await writeFile(
      path.join(dir, "candles.csv"),
      "timestamp,open,high,low,close,volume\n2026-03-09T13:30:00Z,100,101,99,100,100\n2026-03-09T13:31:00Z,100,104,99,103,100\n2026-03-09T13:32:00Z,103,105,102,104,100\n",
    );
    expect(
      (
        await page.request.post("/api/instrument-specifications", {
          data: {
            symbol: "AAPL",
            assetType: "equity",
            contractMultiplier: 1,
            tickSize: 0.01,
            currency: "USD",
          },
        })
      ).status(),
    ).toBe(201);
    await page.goto("/backtesting");
    await page
      .getByRole("button", { name: "New strategy backtest", exact: true })
      .click();
    await page
      .getByLabel("Backtest name", { exact: true })
      .fill("Hand calculated strategy");
    await select(page, "Historical dataset", "AAPL · 1m · backtest-fixture");
    await page.getByRole("button", { name: "Remove condition 3" }).click();
    await page.getByRole("button", { name: "Remove condition 2" }).click();
    await select(page, "Condition 1", "session");
    await select(page, "Entry order", "market");
    await select(page, "Stop rule", "distance");
    await page
      .getByLabel("Stop distance (points or percent)", { exact: true })
      .fill("2");
    await expect(
      page.getByRole("button", { name: "Save strategy" }),
    ).toBeDisabled();
    await page
      .getByLabel("I accept these execution assumptions and costs")
      .check();
    const createdPromise = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/backtest/configs") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save strategy" }).click();
    const created = await (await createdPromise).json();
    expect(created.engineVersion).toBe(2);
    const resultPromise = page.waitForResponse((r) =>
      r.url().endsWith(`/configs/${created._id}/run`),
    );
    await page
      .getByRole("button", { name: "Run backtest", exact: true })
      .click();
    const response = await resultPromise;
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.trades).toHaveLength(2);
    expect(result.summary.netPnL).toBe(5);
    expect(result.summary.totalR).toBe(2.5);
    expect(result.trades[0].exitReason).toBe("target");
    expect(result.trades[1].exitReason).toBe("session");
    await expect(
      page.getByText("Simulated trades", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Executed assumptions", { exact: true }),
    ).toBeVisible();
    expect(
      await (
        await page.request.post(`/api/backtest/configs/${created._id}/run`)
      ).json(),
    ).toEqual(result);
    const actualTrades = await (await page.request.get("/api/trades")).json();
    expect(actualTrades.items).toHaveLength(0);
    await page.keyboard.press("Escape");
    for (const mode of ["light", "dark"]) {
      await page.evaluate(
        (value) => localStorage.setItem("tortoise-scroll-theme", value),
        mode,
      );
      await page.setViewportSize({
        width: mode === "dark" ? 390 : 1280,
        height: 900,
      });
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
      await page
        .getByRole("button", { name: "Edit backtest", exact: true })
        .click();
      await expect(
        page.getByLabel("Backtest name", { exact: true }),
      ).toHaveValue("Hand calculated strategy");
      await expect(
        page.getByRole("button", { name: "Save strategy" }),
      ).toBeDisabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    const foreign = {
      email: `backtest-other-${Date.now()}@example.test`,
      displayName: "Other",
      password: user.password,
    };
    await request.post("/api/auth/register", { data: foreign });
    await request.post("/api/auth/login", {
      data: { email: foreign.email, password: foreign.password },
    });
    expect(
      (
        await request.post(
          `/api/backtest/configs/${created._id}/run?userId=${owner}`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (await request.get(`/api/backtest/configs/${created._id}`)).status(),
    ).toBe(404);
    const edited = await page.request.put(
      `/api/backtest/configs/${created._id}`,
      {
        data: {
          name: "Renamed",
          lastResult: { fabricated: true },
          userId: "64b000000000000000000001",
        },
      },
    );
    expect(edited.status()).toBe(200);
    expect((await edited.json()).lastResult).toBeNull();
    await writeFile(
      path.join(dir, "candles.csv"),
      "timestamp,open,high,low,close\n2026-03-09T13:30:00Z,100,101,99,100\n",
    );
    expect(
      (
        await page.request.post(`/api/backtest/configs/${created._id}/run`)
      ).status(),
    ).toBe(422);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
