import { expect, test } from "@playwright/test";

test.describe("Parent tab UI", () => {
  test("tabs switch and parent-specific panel becomes visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#nessie-tab")).toBeVisible();
    await expect(page.locator("#parent-tab")).toBeHidden();

    await page.getByRole("tab", { name: "Parent" }).click();

    await expect(page.locator("#parent-tab")).toBeVisible();
    await expect(page.locator("#nessie-tab")).toBeHidden();
  });

  test("Nessie-only header controls hide when Parent tab is active", async ({ page }) => {
    await page.goto("/");
    // On Nessie tab, TTS select + status badge are visible.
    await expect(page.locator("#tts-select")).toBeVisible();
    await expect(page.locator("#status-badge")).toBeVisible();

    await page.getByRole("tab", { name: "Parent" }).click();

    await expect(page.locator("#tts-select")).toBeHidden();
    await expect(page.locator("#status-badge")).toBeHidden();
  });

  test("status badge resets to Ready when returning to Nessie tab", async ({ page }) => {
    await page.goto("/");
    // Fake a stale error state by writing to the badge directly.
    await page.locator("#status-badge").evaluate((el) => {
      el.textContent = "Error";
      el.className = "status-badge error";
    });
    await page.getByRole("tab", { name: "Parent" }).click();
    await page.getByRole("tab", { name: "Nessie" }).click();
    await expect(page.locator("#status-badge")).toHaveText("Ready");
  });

  test("typing in Parent input never fires a POST to /v1/speech", async ({ page }) => {
    const speechRequests: string[] = [];
    await page.route("**/v1/speech**", (route) => {
      speechRequests.push(route.request().method());
      route.fulfill({ status: 500, body: "should-not-be-called" });
    });
    await page.goto("/");
    await page.getByRole("tab", { name: "Parent" }).click();
    await page.locator("#ness-input").click();
    await page.keyboard.type("hello ness ");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    // Allow any async handlers a tick.
    await page.waitForTimeout(200);
    expect(speechRequests).toEqual([]);
  });

  test("spacebar outside of text fields does not fire a speech request", async ({ page }) => {
    const speechPosts: string[] = [];
    await page.route("**/v1/speech**", (route) => {
      if (route.request().method() === "POST") speechPosts.push("hit");
      route.fulfill({ status: 200, body: "{}" });
    });
    await page.goto("/");
    await page.locator("body").click();
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
    expect(speechPosts).toEqual([]);
  });

  test("GET /v1/parent_state returns a JSON snapshot", async ({ request }) => {
    const res = await request.get("/v1/parent_state");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty("routine");
    expect(body).toHaveProperty("constraints");
    expect(Array.isArray(body.profiles)).toBe(true);
    expect(Array.isArray(body.persons)).toBe(true);
    expect(Array.isArray(body.upcoming_events)).toBe(true);
  });

  test("active tab persists across page reloads via localStorage", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#nessie-tab")).toBeVisible();

    await page.getByRole("tab", { name: "Parent" }).click();
    await expect(page.locator("#parent-tab")).toBeVisible();

    await page.reload();
    await expect(page.locator("#parent-tab")).toBeVisible();
    await expect(page.locator("#nessie-tab")).toBeHidden();

    await page.getByRole("tab", { name: "Nessie" }).click();
    await page.reload();
    await expect(page.locator("#nessie-tab")).toBeVisible();
    await expect(page.locator("#parent-tab")).toBeHidden();
  });

  test("restoring the Parent tab on reload actually fetches /v1/parent_state", async ({ page }) => {
    let calls = 0;
    await page.route("**/v1/parent_state", (route) => {
      calls++;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          routine: "morning routine example",
          constraints: "- sample constraint",
          profiles: [],
          persons: [{ slug: "grandma-dana", name: "Dana", relation: "grandparent" }],
          upcoming_events: [],
        }),
      });
    });

    await page.goto("/");
    await page.getByRole("tab", { name: "Parent" }).click();
    await expect(page.locator("#sidebar-routine")).toHaveText("morning routine example");

    await page.reload();
    await expect(page.locator("#sidebar-routine")).toHaveText("morning routine example");
    await expect(page.locator("#sidebar-constraints")).toContainText("sample constraint");
    // After reload the Parent tab is restored and the sidebar is populated —
    // this catches the temporal-dead-zone bug where activate() ran before
    // refreshState was defined and the sidebar silently stayed empty.
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  test("sidebar renders runtime config (location, timezone, defaults)", async ({ page }) => {
    await page.route("**/v1/parent_state", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          routine: "",
          constraints: "",
          profiles: [],
          persons: [],
          upcoming_events: [],
          runtime_config: {
            location: { label: "Springfield, Oregon", lat: 44.05, lon: -123.02 },
            timezone: "America/New_York",
            default_voice: "Emily.wav",
            default_provider: "elevenlabs",
          },
        }),
      }),
    );
    await page.goto("/");
    await page.getByRole("tab", { name: "Parent" }).click();
    await expect(page.locator("#sidebar-location")).toContainText("Springfield, Oregon");
    await expect(page.locator("#sidebar-location")).toContainText("44.050");
    await expect(page.locator("#sidebar-timezone")).toHaveText("America/New_York");
    await expect(page.locator("#sidebar-voice")).toHaveText("Emily.wav");
    await expect(page.locator("#sidebar-provider")).toHaveText("elevenlabs");
  });

  test("sidebar shows a visible error when /v1/parent_state fails", async ({ page }) => {
    await page.route("**/v1/parent_state", (route) => route.fulfill({ status: 500, body: "boom" }));
    await page.goto("/");
    await page.getByRole("tab", { name: "Parent" }).click();
    await expect(page.locator("#sidebar-persons")).toContainText("HTTP 500");
  });

  test("sidebar refreshes after a Ness chat response finishes", async ({ page }) => {
    // Flip the /v1/parent_state body between calls so the second fetch
    // (triggered by the chat response finishing) produces a distinct DOM.
    let callCount = 0;
    await page.route("**/v1/parent_state", (route) => {
      callCount++;
      const body =
        callCount === 1
          ? { routine: "v1", constraints: "", profiles: [], persons: [], upcoming_events: [] }
          : {
              routine: "v2-after-chat",
              constraints: "",
              profiles: [],
              persons: [],
              upcoming_events: [],
            };
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.route("**/v1/parent_chat", (route) => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: 'data: {"type":"text","delta":"Got it."}\n\n' + 'data: {"type":"done"}\n\n',
      });
    });

    await page.goto("/");
    await page.getByRole("tab", { name: "Parent" }).click();
    await expect(page.locator("#sidebar-routine")).toHaveText("v1");

    await page.locator("#ness-input").fill("update something");
    await page.locator("#ness-form button[type=submit]").click();

    await expect(page.locator("#sidebar-routine")).toHaveText("v2-after-chat");
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  test("sidebar still refreshes when the chat stream errors", async ({ page }) => {
    let callCount = 0;
    await page.route("**/v1/parent_state", (route) => {
      callCount++;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          routine: callCount === 1 ? "initial" : "after-error",
          constraints: "",
          profiles: [],
          persons: [],
          upcoming_events: [],
        }),
      });
    });

    await page.route("**/v1/parent_chat", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: 'data: {"type":"error","message":"boom"}\n\n',
      }),
    );

    await page.goto("/");
    await page.getByRole("tab", { name: "Parent" }).click();
    await expect(page.locator("#sidebar-routine")).toHaveText("initial");

    await page.locator("#ness-input").fill("break it");
    await page.locator("#ness-form button[type=submit]").click();

    await expect(page.locator("#sidebar-routine")).toHaveText("after-error");
  });

  test("clicking a person opens the detail drawer with their relationships", async ({ page }) => {
    await page.route("**/v1/parent_state", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          routine: "",
          constraints: "",
          profiles: [],
          persons: [
            { slug: "grandma-dana", name: "Dana", relation: "grandparent" },
            { slug: "mom-erin", name: "Erin", relation: "parent" },
          ],
          upcoming_events: [],
        }),
      }),
    );
    await page.route("**/v1/parent_person**", (route) => {
      const url = new URL(route.request().url());
      const slug = url.searchParams.get("slug");
      if (slug === "grandma-dana") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            slug: "grandma-dana",
            name: "Dana",
            relation: "grandparent",
            aliases: ["Nana"],
            notes: "Lives in Seattle.",
            relations: {
              outgoing: [{ edge: "parent_of", to: "mom-erin", name: "Erin" }],
              incoming: [],
            },
          }),
        });
      }
      return route.fulfill({ status: 404, body: "{}" });
    });

    await page.goto("/");
    await page.getByRole("tab", { name: "Parent" }).click();
    await page.getByRole("button", { name: "Dana" }).click();
    const detail = page.locator("#person-detail");
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("Dana");
    await expect(detail).toContainText("Nana");
    await expect(detail).toContainText("parent of");
    await expect(detail).toContainText("Erin");

    await page.locator("#person-detail-close").click();
    await expect(detail).toBeHidden();
  });

  test("sidebar reflects GET /v1/parent_state when switching to Parent tab", async ({ page }) => {
    await page.route("**/v1/parent_state", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          routine: "Up at 7. Dinner at 6.",
          constraints: "- Bath before bed",
          profiles: [{ speaker: "SPEAKER_0", name: "Alex", age: 6, notes: "loves dinosaurs" }],
          persons: [{ slug: "grandma-dana", name: "Dana", relation: "grandparent" }],
          upcoming_events: [{ slug: "2026-05-10-soccer", date: "2026-05-10", title: "Soccer" }],
        }),
      }),
    );
    await page.goto("/");
    await page.getByRole("tab", { name: "Parent" }).click();
    await expect(page.locator("#sidebar-routine")).toHaveText("Up at 7. Dinner at 6.");
    await expect(page.locator("#sidebar-constraints")).toContainText("Bath before bed");
    await expect(page.locator("#sidebar-profiles")).toContainText("Alex");
    await expect(page.locator("#sidebar-persons")).toContainText("Dana");
    await expect(page.locator("#sidebar-events")).toContainText("Soccer");
  });
});
