import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const baseURL = process.env.BASE_URL || "http://127.0.0.1:5174";
const ready = {
  articles: ".article-row",
  sources: ".source-card",
  runs: "tbody tr",
  chat: "#chat-question",
};
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
for (const view of ["articles", "sources", "runs", "chat"]) {
  await page.goto(`${baseURL}/#${view}`);
  await page.locator(ready[view]).first().waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `qa/${view}-desktop.png`, fullPage: false });
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  console.log(
    view,
    JSON.stringify(
      scan.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ),
  );
}
await page.setViewportSize({ width: 390, height: 844 });
for (const view of ["articles", "sources", "runs", "chat"]) {
  await page.goto(`${baseURL}/#${view}`);
  await page.locator(ready[view]).first().waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `qa/${view}-mobile.png`, fullPage: false });
  console.log(
    "overflow",
    view,
    await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    })),
  );
}
console.log("runtime errors", errors);
await browser.close();
