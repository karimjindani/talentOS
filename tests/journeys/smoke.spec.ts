import { expect, test } from "@playwright/test";

test("applicant portal is reachable", async ({ page }) => {
  const response = await page.goto("http://demo.lvh.me:3100/");
  expect(response?.status()).toBe(200);
});
