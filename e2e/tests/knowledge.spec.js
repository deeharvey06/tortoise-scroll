import { test, expect } from "@playwright/test";
async function select(page, label, value) {
  await page.getByRole("combobox", { name: new RegExp(`^${label}`) }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
test("private source → reviewed entry → playbook → classified trade → personal analytics", async ({
  page,
  request,
}) => {
  const credentials = {
    email: `knowledge-${Date.now()}@example.test`,
    password: "knowledge-password-123",
    displayName: "Knowledge owner",
  };
  expect(
    (
      await page.request.post("/api/auth/register", { data: credentials })
    ).status(),
  ).toBe(201);
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: { email: credentials.email, password: credentials.password },
      })
    ).ok(),
  ).toBeTruthy();
  expect((await request.get("/api/knowledge/sources")).status()).toBe(401);
  await page.goto("/knowledge");
  await page
    .getByLabel("Source title", { exact: true })
    .fill("Synthetic review fixture");
  await page
    .getByLabel("Original source text (or select a file)")
    .fill(
      "Fixture Entry\nOnly when the manually recorded context is present. This is synthetic test material, not course knowledge.",
    );
  await page
    .getByRole("button", { name: "Preserve and extract source" })
    .click();
  await expect(
    page.getByText(/Synthetic review fixture.txt: preserved/),
  ).toBeVisible();
  await select(page, "Browse source", "Synthetic review fixture.txt");
  await page
    .getByRole("button", {
      name: "Create knowledge candidate from this section",
    })
    .click();
  await page
    .getByLabel("Knowledge name", { exact: true })
    .fill("Fixture Entry");
  await select(page, "Knowledge kind", "trade entry");
  await page.getByLabel("Context dimension (extensible)").fill("trade_entry");
  await page
    .getByLabel("Reviewed interpretation", { exact: true })
    .fill(
      "A manually reviewed synthetic entry conditional on the stated context.",
    );
  await page.getByRole("button", { name: "Save as Needs Review" }).click();
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel(
      "I verified this interpretation and its qualifications against the source",
    )
    .check();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Knowledge is now approved.")).toBeVisible();
  await page.getByRole("button", { name: "Link approved knowledge" }).click();
  await expect(page.getByText(/Approved knowledge linked/)).toBeVisible();
  const item = (await (await page.request.get("/api/knowledge/items")).json())
    .items[0];
  const source = (
    await (await page.request.get("/api/knowledge/sources")).json()
  )[0];
  const playbook = (await (await page.request.get("/api/playbooks")).json())[0];
  expect(playbook.isActive).toBe(false);
  expect(
    (
      await page.request.post("/api/knowledge/attach", {
        data: { type: "playbook", knowledgeIds: [item._id] },
      })
    ).ok(),
  ).toBeTruthy();
  expect((await (await page.request.get("/api/playbooks")).json()).length).toBe(
    1,
  );
  await page.goto("/playbooks");
  await page
    .getByRole("button", { name: "Edit playbook", exact: true })
    .click();
  const activation = page.getByRole("checkbox", {
    name: "Active — reviewed and ready",
  });
  await expect(activation).not.toBeChecked();
  await activation.check();
  await page.getByRole("dialog").getByRole("button", { name: /Save/ }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    (await (await page.request.get("/api/playbooks")).json())[0].isActive,
  ).toBe(true);
  const account = await (
    await page.request.post("/api/accounts", {
      data: { name: "Knowledge USD", currency: "USD" },
    })
  ).json();
  const tradeResponse = await page.request.post("/api/trades", {
    data: {
      accountId: account._id,
      symbol: "AAPL",
      direction: "long",
      quantity: 2,
      entryPrice: 100,
      exitPrice: 103,
      entryTime: "2026-03-09T13:30:00Z",
      exitTime: "2026-03-09T14:00:00Z",
      stopLoss: 99,
      playbook: playbook._id,
    },
  });
  expect(tradeResponse.status()).toBe(201);
  const trade = await tradeResponse.json();
  await page.goto(`/trades/${trade._id}`);
  const picker = page.getByRole("combobox", {
    name: "Actual market context / pattern / signal / Trade Entry",
  });
  await picker.click();
  await page
    .getByRole("option", { name: "Fixture Entry · trade_entry" })
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Record execution plan" }).click();
  await page.getByLabel("Planned size", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Save methodology review" }).click();
  await expect(
    page.getByText("Context, execution plan and manual review saved."),
  ).toBeVisible();
  await expect(page.getByText("Oversized", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Compare my trades" }).click();
  await expect(page.getByText("Closed-trade sample: 1")).toBeVisible();
  // Ownership and approval gates use the real authenticated API.
  const second = {
    email: `knowledge-other-${Date.now()}@example.test`,
    password: "knowledge-other-123",
    displayName: "Other user",
  };
  expect(
    (await request.post("/api/auth/register", { data: second })).status(),
  ).toBe(201);
  await request.post("/api/auth/login", {
    data: { email: second.email, password: second.password },
  });
  for (const path of [
    `sources/${source._id}`,
    `sources/${source._id}/original`,
    `items/${item._id}`,
    `trades/${trade._id}`,
  ])
    expect((await request.get(`/api/knowledge/${path}`)).status()).toBe(404);
  expect(
    (
      await request.post(`/api/knowledge/items/${item._id}/review`, {
        data: { revision: item.revision, status: "rejected" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post("/api/knowledge/attach", {
        data: {
          type: "playbook",
          targetId: playbook._id,
          knowledgeIds: [item._id],
        },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await page.request.put(`/api/playbooks/${playbook._id}`, {
        data: { knowledgeIds: [item._id] },
      })
    ).status(),
  ).toBe(400);
  const original = await page.request.get(
    `/api/knowledge/sources/${source._id}/original`,
  );
  expect(original.ok()).toBeTruthy();
  expect(await original.text()).toContain("Only when");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/knowledge");
  await expect(
    page.getByRole("heading", { name: "Methodology", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("review transitions, scenarios, snapshots, currency isolation and inactive knowledge gates", async ({
  page,
}) => {
  const api = page.request;
  const credentials = {
    email: `knowledge-lifecycle-${Date.now()}@example.test`,
    password: "knowledge-lifecycle-123",
    displayName: "Lifecycle owner",
  };
  expect(
    (await api.post("/api/auth/register", { data: credentials })).status(),
  ).toBe(201);
  await api.post("/api/auth/login", {
    data: { email: credentials.email, password: credentials.password },
  });
  const sourceInput = {
    sourceType: "PRICE_ACTION_BONUS",
    title: "Incomplete synthetic source",
    text: "Example: a context-dependent entry. The source is incomplete.",
  };
  const sourceResponse = await api.post("/api/knowledge/sources", {
    data: sourceInput,
  });
  expect(sourceResponse.status()).toBe(201);
  const sourceId = (await sourceResponse.json()).results[0].sourceId;
  expect(
    (await (await api.get(`/api/knowledge/sources/${sourceId}`)).json())
      .incomplete,
  ).toBe(true);
  const duplicate = await (
    await api.post("/api/knowledge/sources", { data: sourceInput })
  ).json();
  expect(duplicate.results[0].duplicate).toBe(true);
  const base = {
    name: "Lifecycle entry",
    kind: "trade_entry",
    dimension: "trade_entry",
    interpretation: "Only when the specified context is present.",
    references: [{ sourceId, sectionId: "page-1" }],
  };
  let item = await (
    await api.post("/api/knowledge/items", { data: base })
  ).json();
  expect(item.status).toBe("needs_review");
  expect(
    (
      await api.post("/api/knowledge/attach", {
        data: { type: "strategy", knowledgeIds: [item._id] },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await api.post(`/api/knowledge/items/${item._id}/review`, {
        data: { revision: 1, status: "approved" },
      })
    ).status(),
  ).toBe(400);
  item = await (
    await api.post(`/api/knowledge/items/${item._id}/review`, {
      data: { revision: 1, status: "approved", verification: true },
    })
  ).json();
  expect(item.status).toBe("approved");
  const strategy = await (
    await api.post("/api/strategies", {
      data: { name: "Existing strategy", entryRules: "Keep my original rules" },
    })
  ).json();
  expect(
    (
      await api.post("/api/knowledge/attach", {
        data: {
          type: "strategy",
          targetId: strategy._id,
          knowledgeIds: [item._id],
        },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (await (await api.get(`/api/strategies/${strategy._id}`)).json())
      .entryRules,
  ).toBe("Keep my original rules");
  const accounts = [];
  for (const currency of ["USD", "EUR"])
    accounts.push(
      await (
        await api.post("/api/accounts", {
          data: { name: `Lifecycle ${currency}`, currency },
        })
      ).json(),
    );
  const plan = await (
    await api.post("/api/journal", {
      data: {
        type: "pre-market",
        title: "Morning scenarios",
        date: "2026-03-09T00:00:00Z",
        content: "Original freeform preparation",
        accountId: accounts[0]._id,
        preparation: {
          knowledgeIds: [item._id],
          scenarios: [
            {
              name: "Scenario A",
              condition: "IF a test occurs",
              context: "Manual context",
              lookFor: "Approved entry",
              avoid: "Undefined conditions",
              invalidatedBy: "Condition no longer holds",
              knowledgeIds: [item._id],
            },
          ],
        },
      },
    })
  ).json();
  expect(plan.content).toBe("Original freeform preparation");
  expect(plan.preparation.scenarios[0]._id).toBeTruthy();
  const trades = [];
  for (const account of accounts) {
    const r = await api.post("/api/trades", {
      data: {
        accountId: account._id,
        symbol: "AAPL",
        direction: "long",
        quantity: 1,
        entryPrice: 100,
        exitPrice: 102,
        entryTime: "2026-03-09T13:30:00Z",
        exitTime: "2026-03-09T14:30:00Z",
      },
    });
    expect(r.status()).toBe(201);
    trades.push(await r.json());
  }
  const context = {
    revision: 0,
    knowledgeIds: [item._id],
    journalId: plan._id,
    scenarioId: plan.preparation.scenarios[0]._id,
    plan: {
      size: 1,
      risk: 1,
      strategy: strategy._id,
      knowledgeIds: [item._id],
    },
    review: {
      scenarioMatched: true,
      contextCorrect: true,
      setupPresent: false,
    },
  };
  const saved = await api.put(`/api/knowledge/trades/${trades[0]._id}`, {
    data: context,
  });
  expect(saved.ok(), await saved.text()).toBeTruthy();
  expect(
    (
      await api.put(`/api/knowledge/trades/${trades[0]._id}`, { data: context })
    ).status(),
  ).toBe(409);
  expect(
    (
      await api.put(`/api/knowledge/trades/${trades[1]._id}`, { data: context })
    ).status(),
  ).toBe(400);
  expect(
    (
      await api.put(`/api/knowledge/trades/${trades[1]._id}`, {
        data: { revision: 0, knowledgeIds: [item._id] },
      })
    ).ok(),
  ).toBeTruthy();
  const analytics = await (
    await api.post("/api/knowledge/analytics", {
      data: { knowledgeIds: [item._id] },
    })
  ).json();
  expect(analytics.sampleSize).toBe(2);
  expect(analytics.groups.map((g) => g.currency).sort()).toEqual([
    "EUR",
    "USD",
  ]);
  expect(
    analytics.groups.every((g) => g.sampleSize === 1 && g.netPnL === 2),
  ).toBeTruthy();
  const filtered = await (
    await api.post("/api/knowledge/analytics", {
      data: {
        knowledgeIds: [item._id],
        review: { contextCorrect: true, setupPresent: false },
        accountId: accounts[0]._id,
      },
    })
  ).json();
  expect(filtered.sampleSize).toBe(1);
  const empty = await (
    await api.post("/api/knowledge/analytics", {
      data: { dateFrom: "2026-04-01T00:00:00Z" },
    })
  ).json();
  expect(empty.sampleSize).toBe(0);
  // Editing approved methodology withdraws it from active links but preserves trade snapshots.
  item = await (
    await api.put(`/api/knowledge/items/${item._id}`, {
      data: {
        ...base,
        interpretation: "Changed meaning awaiting review",
        revision: item.revision,
      },
    })
  ).json();
  expect(item.status).toBe("needs_review");
  const attached = await (
    await api.get(`/api/knowledge/targets/strategy/${strategy._id}`)
  ).json();
  expect(attached.items).toHaveLength(0);
  expect(attached.inactive).toHaveLength(1);
  const historical = await (
    await api.get(`/api/knowledge/trades/${trades[0]._id}`)
  ).json();
  expect(historical.methodology.snapshot[0].interpretation).toBe(
    base.interpretation,
  );
  expect(historical.knowledge).toHaveLength(0);
  expect(historical.methodology.scenario.content).toBe(plan.content);
  for (const status of ["rejected", "superseded"]) {
    item = await (
      await api.post(`/api/knowledge/items/${item._id}/review`, {
        data: { revision: item.revision, status },
      })
    ).json();
    expect(item.status).toBe(status);
  }
});
