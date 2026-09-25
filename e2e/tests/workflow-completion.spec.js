import { test, expect } from "@playwright/test";
async function select(page, label, value) {
  await page.getByRole("combobox", { name: new RegExp(`^${label}`) }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
async function login(page) {
  const data = {
    email: `workflow-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`,
    password: "workflow-test-password-123",
    displayName: "Workflow owner",
  };
  expect(
    (await page.request.post("/api/auth/register", { data })).status(),
  ).toBe(201);
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: { email: data.email, password: data.password },
      })
    ).ok(),
  ).toBeTruthy();
}
async function post(page, path, data) {
  const r = await page.request.post("/api/" + path, { data });
  expect(r.ok()).toBeTruthy();
  return r.json();
}
test("trade labels, confirmed bulk edits, saved filters, layouts, import review and owned search work together", async ({
  page,
  request,
}) => {
  await login(page);
  const account = await post(page, "accounts", { name: "Workflow account" }),
    strategy = await post(page, "strategies", { name: "Workflow strategy" }),
    playbook = await post(page, "playbooks", {
      setupName: "Workflow playbook",
    });
  const trade = await post(page, "trades", {
    accountId: account._id,
    strategy: strategy._id,
    playbook: playbook._id,
    symbol: "UXTEST",
    direction: "long",
    quantity: 1,
    entryPrice: 100,
    exitPrice: 90,
    entryTime: "2026-01-01T10:00:00Z",
    exitTime: "2026-01-01T11:00:00Z",
    setup: "H2",
    notes: "Unique workflow note",
  });
  await page.goto("/trades/" + trade._id);
  await expect(
    page.getByText("Workflow account", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Workflow strategy", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Workflow playbook", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save journal" }).click();
  await expect(page.getByText("Journal saved", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Workflow account", { exact: true }),
  ).toBeVisible();
  await page.goto("/trades");
  await page.getByRole("checkbox", { name: "Select UXTEST trade" }).check();
  await page.getByRole("button", { name: "Edit selected" }).click();
  await page.getByLabel("New value", { exact: true }).fill("Morning H2");
  await page.getByRole("button", { name: "Review changes" }).click();
  expect(
    (await (await page.request.get("/api/trades/" + trade._id)).json()).setup,
  ).toBe("H2");
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.getByText("Updated 1 trades.")).toBeVisible();
  expect(
    (await (await page.request.get("/api/trades/" + trade._id)).json()).netPnL,
  ).toBe(-10);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Symbol", { exact: true }).fill("UXTEST");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Saved filters", exact: true })
    .click();
  await page.getByLabel("Filter name").fill("UX Only");
  await page.getByRole("button", { name: "Save current filters" }).click();
  await expect(page.getByText("Saved filters updated.")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Table layout" }).click();
  await page.getByRole("button", { name: "Move Symbol earlier" }).click();
  await select(page, "Table density", "Comfortable");
  await page.getByRole("button", { name: "Save layout" }).click();
  await expect(page.getByText("Table layout saved.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Select UXTEST trade" }),
  ).toBeVisible();
  const headers = page
    .getByRole("table", { name: "Trades", exact: true })
    .getByRole("columnheader");
  await expect(headers.nth(1)).toHaveText("Symbol");
  await expect(headers.nth(2)).toHaveText("Date");
  // A deliberately chosen saved filter must outrank table defaults on SPA navigation.
  expect(
    (
      await page.request.put("/api/settings/workspace", {
        data: {
          savedFilters: [
            {
              id: "c8904dd5-c858-41d4-868c-78335f8c31c9",
              name: "No matches",
              filters: { symbol: "ABSENT" },
            },
          ],
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/reports");
  await page
    .getByRole("button", { name: "Saved filters", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByRole("link", { name: "Trades", exact: true }).click();
  await expect(
    page.getByText("No trades recorded", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await page.request.post("/api/trades/bulk-edit", {
        headers: { "X-CSRF-Protection": "" },
        data: { ids: [trade._id], changes: { setup: "blocked" } },
      })
    ).status(),
  ).toBe(403);
  await page.getByRole("button", { name: "Search workspace" }).click();
  await page
    .getByRole("textbox", { name: /Search your trades/ })
    .fill("Unique workflow note");
  await page.getByRole("link", { name: /UXTEST/ }).click();
  await expect(page).toHaveURL("/trades/" + trade._id);
  expect((await request.get("/api/search?q=UXTEST")).status()).toBe(401);
  expect((await request.get("/api/settings/workspace")).status()).toBe(401);
  const data = {
    email: `outsider-${Date.now()}@example.test`,
    password: "outsider-password-123",
    displayName: "Other user",
  };
  await request.post("/api/auth/register", { data });
  await request.post("/api/auth/login", {
    data: { email: data.email, password: data.password },
  });
  expect(
    (await (await request.get("/api/settings/workspace")).json()).savedFilters,
  ).toEqual([]);
  const otherSearch = await (await request.get("/api/search?q=UXTEST")).json();
  expect(otherSearch.groups.every((g) => g.items.length === 0)).toBeTruthy();
  expect(
    (
      await request.post("/api/trades/bulk-edit", {
        data: { ids: [trade._id], changes: { setup: "hacked" } },
      })
    ).status(),
  ).toBe(404);
  const file = Buffer.from(
    "Symbol,Direction,Quantity,Entry Price,Exit Price,Entry Time,Exit Time\nIMPUX,long,1,100,101,2026-01-02T10:00:00Z,2026-01-02T11:00:00Z",
  );
  const mapping = JSON.stringify({
    symbol: "Symbol",
    direction: "Direction",
    quantity: "Quantity",
    entryPrice: "Entry Price",
    exitPrice: "Exit Price",
    entryTime: "Entry Time",
    exitTime: "Exit Time",
  });
  for (let i = 0; i < 2; i++)
    expect(
      (
        await page.request.post("/api/import/commit", {
          multipart: {
            file: { name: "workflow.csv", mimeType: "text/csv", buffer: file },
            accountId: account._id,
            broker: "generic",
            mapping,
          },
        })
      ).status(),
    ).toBe(201);
  await page.goto("/import");
  await page
    .getByRole("button", { name: "View results for workflow.csv" })
    .first()
    .click();
  await expect(
    page.getByText("Skipped duplicate", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Review trade" })).toBeVisible();
});

test("new workflow controls remain usable in light/dark mobile layouts and existing routes render", async ({
  page,
}) => {
  await login(page);
  const failures = [];
  page.on("pageerror", (e) => failures.push(e.message));
  for (const mode of ["light", "dark"]) {
    await page.goto("/trades");
    await page.evaluate(
      (mode) => localStorage.setItem("tortoise-scroll-theme", mode),
      mode,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
    await page.getByRole("button", { name: "Table layout" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page
      .getByRole("button", { name: "Saved filters", exact: true })
      .click();
    await expect(page.getByText("No saved filters")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Search workspace" }).click();
    await expect(page.getByRole("textbox")).toBeFocused();
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const path of [
    "/",
    "/trades",
    "/accounts",
    "/calendar",
    "/journal",
    "/strategies",
    "/playbooks",
    "/reports",
    "/analytics",
    "/replay",
    "/backtesting",
    "/risk",
    "/import",
    "/settings",
    "/security",
  ]) {
    await page.goto(path);
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("#main-content")).not.toBeEmpty();
  }
  expect(failures).toEqual([]);
});
