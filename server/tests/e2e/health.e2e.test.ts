import { expect, test } from "@playwright/test";

test("GET /health returns ok", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(typeof body.uptime).toBe("number");
});
