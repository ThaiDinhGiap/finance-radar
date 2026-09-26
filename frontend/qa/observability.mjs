import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const password = (
  await readFile(
    new URL("../../.local/grafana-admin-password", import.meta.url),
    "utf8",
  )
).trim();
const response = await context.request.post("http://127.0.0.1:3000/login", {
  data: { user: "admin", password },
});
if (!response.ok()) throw new Error("Grafana login failed");
const page = await context.newPage();
for (const name of ["ai", "index", "crawler", "infra"]) {
  await page.goto(`http://127.0.0.1:3000/d/radar-${name}?from=now-6h&to=now`);
  await page.getByText("Finance Radar", { exact: true }).first().waitFor();
  await page
    .locator('[data-testid="data-testid Panel header"]')
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  await page.screenshot({ path: `qa/grafana-${name}.png`, fullPage: true });
  console.log(name, "dashboard rendered");
}
await browser.close();
