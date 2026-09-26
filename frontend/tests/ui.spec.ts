import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const source = {
  id: "source-1",
  name: "Bản tin kinh tế",
  url: "https://example.com/rss",
  kind: "RSS",
  category: "NEWS",
  language: "vi",
  region: "VN",
  enabled: true,
  intervalMinutes: 30,
  activeRunId: null,
  nextRunAt: "2026-09-24T06:00:00Z",
  lastSuccessAt: "2026-09-24T05:30:00Z",
  failures: 0,
  itemSelector: null,
  titleSelector: null,
  linkSelector: null,
  summarySelector: null,
};
const article = {
  id: "article-1",
  sourceId: source.id,
  sourceName: source.name,
  title: "Thông tin lãi suất và thị trường",
  summary: "Bản tin cung cấp thông tin về lãi suất.",
  url: "https://example.com/article",
  category: "NEWS",
  language: "vi",
  region: "VN",
  publishedAt: "2026-09-24T05:00:00Z",
  collectedAt: "2026-09-24T05:30:00Z",
};
const status = {
  configured: true,
  provider: "OpenRouter",
  model: "test",
  embeddingModel: "test",
  index: { ready: 1, pending: 0, failed: 0, chunks: 1 },
  knowledge: { articles: 1, sources: 1, lastCollectedAt: article.collectedAt },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/stories/curation-history")
      return route.fulfill({ json: [] });
    if (url.pathname === "/api/topics")
      return route.fulfill({
        json: [{ id: "fpt", name: "FPT", kind: "ENTITY", articles: 1 }],
      });
    if (url.pathname === "/api/stats")
      return route.fulfill({
        json: {
          articles: 31,
          sources: 2,
          enabledSources: 1,
          runningSources: 0,
          failingSources: 0,
        },
      });
    if (url.pathname === "/api/sources")
      return route.fulfill({
        json: [
          source,
          { ...source, id: "source-2", name: "Nguồn tạm dừng", enabled: false },
        ],
      });
    if (url.pathname === "/api/stories")
      return route.fulfill({
        json: {
          items:
            url.searchParams.get("q") === "không có"
              ? []
              : [
                  {
                    id: article.id,
                    lead: article,
                    matchingArticles: 1,
                    totalArticles: 1,
                    sources: 1,
                    lastCollectedAt: article.collectedAt,
                    clustered: true,
                  },
                ],
          total: url.searchParams.get("q") === "không có" ? 0 : 31,
          page: Number(url.searchParams.get("page") ?? 0),
          size: 15,
        },
      });
    if (url.pathname === "/api/articles")
      return route.fulfill({
        json: {
          items: url.searchParams.get("q") === "không có" ? [] : [article],
          total: url.searchParams.get("q") === "không có" ? 0 : 31,
          page: Number(url.searchParams.get("page") ?? 0),
          size: 15,
        },
      });
    if (url.pathname === "/api/chat/status")
      return route.fulfill({ json: status });
    if (url.pathname === "/api/runs")
      return route.fulfill({
        json: {
          items: [
            {
              id: "run-1",
              sourceId: source.id,
              sourceName: source.name,
              status: "SUCCESS",
              createdAt: article.collectedAt,
              fetched: 10,
              inserted: 2,
              rejected: 0,
              message: null,
            },
          ],
          total: 1,
          page: 0,
          size: 20,
        },
      });
    return route.fulfill({ json: {} });
  });
});

test("navigation supports direct links, browser back, and retained chat drafts", async ({
  page,
}) => {
  await page.goto("/#articles");
  await page.getByRole("link", { name: "AI đọc tin", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Câu hỏi về kho tin" })
    .fill("Diễn biến lãi suất?");
  await page.getByRole("link", { name: "Nguồn dữ liệu", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("textbox", { name: "Câu hỏi về kho tin" }),
  ).toHaveValue("Diễn biến lãi suất?");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "AI đọc tin", exact: true }),
  ).toBeVisible();
});

test("search resets pagination and empty results provide recovery", async ({
  page,
}) => {
  await page.goto("/#articles");
  await page.getByRole("button", { name: "Trang sau" }).click();
  await expect(page.getByText("Trang 2 / 3")).toBeVisible();
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/api/stories?") &&
      new URL(r.url()).searchParams.get("q") === "không có",
  );
  await page
    .getByRole("textbox", { name: "Tìm kiếm bài viết" })
    .fill("không có");
  expect(new URL((await request).url()).searchParams.get("page")).toBe("0");
  await expect(
    page.getByRole("heading", { name: "Chưa có bài viết phù hợp" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Xóa bộ lọc", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: article.title, exact: true }),
  ).toBeVisible();
});

test("article dialog traps keyboard focus and restores its opener", async ({
  page,
}) => {
  await page.goto("/#articles");
  await page.getByRole("button", { name: "Bố cục thẻ" }).click();
  await expect(page.locator(".article-list")).toHaveClass(/editorial/);
  const opener = page.getByRole("button", { name: article.title, exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("source search, status filters and source form preserve payload fields", async ({
  page,
}) => {
  await page.goto("/#sources");
  await page.getByLabel("Lọc trạng thái nguồn").selectOption("paused");
  await expect(page.locator(".source-card")).toHaveCount(1);
  await expect(
    page
      .locator(".source-card")
      .getByRole("button", { name: "Thu thập", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Tìm nguồn dữ liệu").fill("không tồn tại");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy nguồn phù hợp" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await page.getByRole("button", { name: "Thêm nguồn", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên nguồn").fill("Nguồn mới");
  await dialog.getByLabel("URL nguồn").fill("https://example.com/news");
  await dialog.getByLabel("Phương thức").selectOption("HTML");
  await dialog.getByLabel("Mục bài viết").fill("article");
  await dialog.getByLabel("Tiêu đề", { exact: true }).fill("h2");
  await dialog.getByLabel("Liên kết", { exact: true }).fill("a");
  const request = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/api/sources"),
  );
  await dialog.getByRole("button", { name: "Lưu nguồn" }).click();
  expect((await request).postDataJSON()).toMatchObject({
    name: "Nguồn mới",
    kind: "HTML",
    category: "NEWS",
    itemSelector: "article",
    titleSelector: "h2",
    linkSelector: "a",
    intervalMinutes: 30,
  });
  await expect(page.getByText("Đã lưu cấu hình nguồn.")).toBeVisible();
});

test("AI answer citations open original evidence and conversation can be cleared", async ({
  page,
}) => {
  await page.route("**/api/chat/answer", (route) =>
    route.fulfill({
      json: {
        status: "ANSWERED",
        message: "",
        statements: [
          {
            text: "Bản tin đề cập đến lãi suất.",
            evidence: [{ articleId: article.id, quote: article.summary }],
          },
        ],
        sources: [article],
        answeredAt: article.collectedAt,
      },
    }),
  );
  await page.goto("/#chat");
  await page
    .getByRole("button", { name: "Các báo đang nói gì về lãi suất?" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Câu hỏi về kho tin" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Hỏi AI", exact: true }).click();
  await page.getByRole("button", { name: "Xem nguồn 1" }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: article.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Mở bài gốc" }),
  ).toHaveAttribute("href", article.url);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Cuộc trò chuyện mới" }).click();
  await expect(
    page.getByRole("heading", { name: "Bắt đầu từ một câu hỏi." }),
  ).toBeVisible();
});

test("AI unavailable state explains disabled actions", async ({ page }) => {
  await page.route("**/api/chat/status", (route) =>
    route.fulfill({
      json: { ...status, index: { ...status.index, ready: 0, pending: 1 } },
    }),
  );
  await page.goto("/#chat");
  await expect(page.getByText("Kho tin chưa sẵn sàng")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Câu hỏi về kho tin" })
    .fill("Lãi suất?");
  await expect(
    page.getByRole("button", { name: "Hỏi AI", exact: true }),
  ).toBeDisabled();
});

test("mobile filters are accessible and all routes fit a 320px viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/#articles");
  await page.getByRole("button", { name: "Bộ lọc bài viết" }).click();
  await expect(
    page.getByRole("combobox", { name: "Nguồn tin", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Nguồn tin", exact: true })
    .selectOption(source.id);
  await expect(page.locator(".active-filters")).toContainText(source.name);
  for (const route of ["articles", "sources", "runs", "chat"]) {
    await page.goto(`/#${route}`);
    await expect(page.locator("main h1:visible")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});

test("failed and empty run requests do not show contradictory states", async ({
  page,
}) => {
  await page.route("**/api/runs?**", (route) =>
    route.fulfill({ status: 503, json: { message: "Không thể tải nhật ký" } }),
  );
  await page.goto("/#runs");
  await expect(page.locator("main [role=alert]")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chưa có lượt thu thập" }),
  ).toHaveCount(0);
});

test("AI configuration is distinct from observed health", async ({ page }) => {
  await page.route("**/api/chat/status", (route) =>
    route.fulfill({
      json: {
        ...status,
        activity: {
          embedding: {
            status: "HEALTHY",
            lastSuccessAt: article.collectedAt,
            lastFailureAt: null,
            lastErrorType: null,
          },
          generation: {
            status: "DEGRADED",
            lastSuccessAt: null,
            lastFailureAt: article.collectedAt,
            lastErrorType: "RATE_LIMITED",
          },
        },
      },
    }),
  );
  await page.goto("/#chat");
  await expect(page.getByText("Đã cấu hình AI", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Lần gọi gần nhất thành công", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Lần gọi gần nhất có lỗi", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Đã kết nối AI", { exact: true })).toHaveCount(0);
});

test("failed AI response exposes a correlation ID without losing the question", async ({
  page,
}) => {
  let sentId: string | undefined;
  await page.route("**/api/chat/answer", (route) => {
    sentId = route.request().headers()["x-request-id"];
    return route.fulfill({
      status: 502,
      json: {
        code: "TIMEOUT",
        message: "Dịch vụ AI phản hồi quá thời gian.",
        requestId: "request-test-123",
      },
    });
  });
  await page.goto("/#chat");
  await page
    .getByRole("textbox", { name: "Câu hỏi về kho tin" })
    .fill("Lãi suất gần đây?");
  await page.getByRole("button", { name: "Hỏi AI", exact: true }).click();
  await expect(page.getByText(/Mã yêu cầu: request-test-123/)).toBeVisible();
  await expect(
    page.getByText("Lãi suất gần đây?", { exact: true }).first(),
  ).toBeVisible();
  expect(sentId).toMatch(/^[a-f0-9-]{36}$/);
});

test("saved search restores rolling filters after reload and transfers scope to chat", async ({
  page,
}) => {
  await page.goto("/#articles");
  await page.getByLabel("Tìm kiếm bài viết").fill("đầu tư công");
  await page
    .getByLabel("Địa danh trong tin", { exact: true })
    .first()
    .fill("Nghệ An");
  await page.getByLabel("Thời gian", { exact: true }).selectOption("7");
  await page.getByLabel("Tên tìm kiếm").fill("Nghệ An tuần này");
  await page.getByRole("button", { name: "Lưu tìm kiếm hiện tại" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Nghệ An tuần này", exact: true })
    .click();
  await expect(page.getByLabel("Tìm kiếm bài viết")).toHaveValue("đầu tư công");
  await expect(page.getByLabel("Thời gian", { exact: true })).toHaveValue("7");
  await page.getByRole("button", { name: "Hỏi AI trong phạm vi này" }).click();
  await page.route("**/api/chat/retrieve", (r) => r.fulfill({ json: [] }));
  await page.getByLabel("Câu hỏi về kho tin").fill("Tổng hợp thông tin?");
  const request = page.waitForRequest("**/api/chat/retrieve");
  await page.getByRole("button", { name: "Tìm theo ngữ nghĩa" }).click();
  expect((await request).postDataJSON()).toMatchObject({
    days: 7,
    filter: { q: "đầu tư công", location: "Nghệ An" },
  });
});

test("watchlists retain OR terms, new arrival cutoff, edits and removal", async ({
  page,
}) => {
  await page.goto("/#articles");
  await page.getByRole("button", { name: "Tạo Watchlist" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên Watchlist").fill("Doanh nghiệp");
  await dialog.getByLabel("Entity / Topic").selectOption("fpt");
  await dialog.getByLabel("Nguồn theo dõi").selectOption("source-1");
  await dialog.getByLabel("Từ khóa").fill("lãi suất\nđầu tư công");
  await dialog.getByRole("button", { name: "Lưu Watchlist" }).click();
  await page.reload();
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/api/stories?") &&
      new URL(r.url()).searchParams.has("collectedAfter"),
  );
  await page.getByRole("button", { name: "Tin mới", exact: true }).click();
  const params = new URL((await request).url()).searchParams;
  expect(params.getAll("keywords")).toEqual(["lãi suất", "đầu tư công"]);
  expect(params.get("topicIds")).toBe("fpt");
  expect(params.get("watchedSourceIds")).toBe("source-1");
  await page.getByRole("button", { name: "Sửa Doanh nghiệp" }).click();
  await dialog.getByLabel("Tên Watchlist").fill("Theo dõi mới");
  await dialog.getByRole("button", { name: "Lưu Watchlist" }).click();
  await page.getByRole("button", { name: "Xóa Theo dõi mới" }).click();
  await expect(
    page.getByRole("button", { name: "Tin mới", exact: true }),
  ).toHaveCount(0);
});

test("story selection sends exact article IDs and scope change discards question context", async ({
  page,
}) => {
  await page.route("**/api/chat/retrieve", (r) =>
    r.fulfill({ json: [article] }),
  );
  await page.goto("/#articles");
  await page.getByLabel(`Chọn bài: ${article.title}`).check();
  await page.getByRole("button", { name: "Hỏi AI về 1 bài đã chọn" }).click();
  await page.getByLabel("Câu hỏi về kho tin").fill("Tin này nói gì?");
  let req = page.waitForRequest("**/api/chat/retrieve");
  await page.getByRole("button", { name: "Tìm theo ngữ nghĩa" }).click();
  expect((await req).postDataJSON().filter.articleIds).toEqual([article.id]);
  await expect(page.getByLabel("Câu hỏi về kho tin")).toHaveValue("");
  await page.getByRole("button", { name: "Xóa phạm vi, về 30 ngày" }).click();
  await page.getByLabel("Câu hỏi về kho tin").fill("Còn gì nữa?");
  req = page.waitForRequest("**/api/chat/retrieve");
  await page.getByRole("button", { name: "Tìm theo ngữ nghĩa" }).click();
  expect((await req).postDataJSON().previousQuestions).toEqual([]);
});

test("story feed collapses coverage, retains raw view and sends persistent story scope", async ({
  page,
}) => {
  await page.route("**/api/stories?**", (r) =>
    r.fulfill({
      json: {
        items: [
          {
            id: "story-1",
            lead: article,
            matchingArticles: 2,
            totalArticles: 2,
            sources: 2,
            lastCollectedAt: article.collectedAt,
            clustered: true,
          },
        ],
        total: 1,
        page: 0,
        size: 15,
      },
    }),
  );
  await page.route("**/api/articles?**", (r) =>
    r.fulfill({
      json: {
        items: [
          article,
          { ...article, id: "article-2", sourceName: "Nguồn thứ hai" },
        ],
        total: 2,
        page: 0,
        size: 15,
      },
    }),
  );
  await page.route("**/api/chat/retrieve", (r) => r.fulfill({ json: [] }));
  await page.goto("/#articles");
  await expect(page.locator(".article-row")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Gom theo Story" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Từng bài viết" }).click();
  await expect(page.locator(".article-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Gom theo Story" }).click();
  await page.getByRole("button", { name: "Xem Story · 2 bài" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".story-member")).toHaveCount(2);
  await expect(dialog.getByText("Nguồn thứ hai")).toBeVisible();
  await dialog.getByRole("button", { name: "Hỏi AI về Story này" }).click();
  await page
    .getByLabel("Câu hỏi về kho tin")
    .fill("Sự kiện này diễn ra thế nào?");
  const request = page.waitForRequest("**/api/chat/retrieve");
  await page.getByRole("button", { name: "Tìm theo ngữ nghĩa" }).click();
  const payload = (await request).postDataJSON();
  expect(payload.filter.storyId).toBe("story-1");
  expect(payload.filter.articleIds).toBeUndefined();
});

test("story errors stay visible and users can recover using raw articles", async ({
  page,
}) => {
  await page.route("**/api/stories?**", (r) =>
    r.fulfill({ status: 503, json: { detail: "Không tải được Story" } }),
  );
  await page.goto("/#articles");
  await expect(page.getByRole("alert")).toContainText("Không tải được Story");
  await expect(page.locator(".article-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Từng bài viết" }).click();
  await expect(page.locator(".article-row")).toHaveCount(1);
});

test("timeline opens the Story scope and keeps event chronology and source links", async ({
  page,
}) => {
  await page.route("**/api/timeline?**", (r) =>
    r.fulfill({
      json: {
        items: [
          { ...article, id: "early", publishedAt: "2026-09-24T01:00:00Z" },
          { ...article, id: "late", publishedAt: null },
        ],
        total: 2,
        page: 0,
        size: 20,
      },
    }),
  );
  await page.goto("/#articles");
  await page.getByRole("button", { name: "Xem Story · 1 bài" }).click();
  const requested = page.waitForRequest("**/api/timeline?**");
  await page
    .getByRole("button", { name: "Timeline Story", exact: true })
    .click();
  expect(new URL((await requested).url()).searchParams.get("storyId")).toBe(
    article.id,
  );
  await expect(page.locator(".timeline-list li")).toHaveCount(2);
  await expect(page.locator(".timeline-list li").last()).toContainText(
    "Thiếu ngày xuất bản",
  );
  await expect(page.locator(".timeline-list a").first()).toHaveAttribute(
    "href",
    article.url,
  );
  const changed = page.waitForRequest(
    (r) =>
      r.url().includes("/api/timeline?") &&
      new URL(r.url()).searchParams.get("days") === "1",
  );
  await page.getByLabel("Thời gian Timeline").selectOption("1");
  await changed;
});

test("daily and weekly digest retain original citations", async ({ page }) => {
  await page.route("**/api/digest?**", (r) =>
    r.fulfill({
      json: {
        from: "2026-09-23T17:00:00Z",
        until: "2026-09-24T17:00:00Z",
        totalStories: 1,
        items: [
          {
            storyId: "story-1",
            topic: "Lãi suất",
            lead: article,
            articleCount: 2,
            sourceCount: 2,
            citations: [article],
          },
        ],
      },
    }),
  );
  await page.goto("/#digest");
  await expect(
    page.getByRole("heading", { name: "Lãi suất", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".citation-list a")).toHaveAttribute(
    "href",
    article.url,
  );
  const changed = page.waitForRequest(
    (r) =>
      r.url().includes("/api/digest?") &&
      new URL(r.url()).searchParams.get("period") === "week",
  );
  await page.getByLabel("Kỳ Digest").selectOption("week");
  await changed;
  await expect(
    page.getByText("Hiển thị 1 bài nguồn mới nhất trong kỳ."),
  ).toBeVisible();
});

test("operator dashboard drills into missing summaries and recorded parse failures", async ({
  page,
}) => {
  await page.route("**/api/operations", (r) =>
    r.fulfill({
      json: {
        sampledAt: article.collectedAt,
        counts: {
          articles: 2,
          index_ready: 1,
          index_pending: 0,
          index_failed: 1,
          missing_summary: 1,
          parse_failures_7d: 1,
        },
        sources: [
          {
            id: source.id,
            name: source.name,
            state: "FAILED",
            lastSuccessAt: null,
            failures: 1,
            missingPublishedAt: 0,
            missingSummary: 1,
            articles: 2,
          },
        ],
      },
    }),
  );
  await page.route("**/api/operations/quality/articles?**", (r) =>
    r.fulfill({
      json: {
        items: [{ ...article, summary: "" }],
        total: 1,
        page: 0,
        size: 20,
      },
    }),
  );
  await page.route("**/api/operations/failures?**", (r) =>
    r.fulfill({
      json: {
        items: [
          {
            id: "run-1",
            sourceName: source.name,
            errorType: "PARSE",
            message: "Không phân tích được nội dung nguồn",
            finishedAt: article.collectedAt,
          },
        ],
        total: 1,
        page: 0,
        size: 20,
      },
    }),
  );
  await page.goto("/#operations");
  await expect(page.getByText("Đang lỗi", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Xem vấn đề" }).click();
  await expect(page.getByLabel("Nguồn chất lượng")).toHaveValue(source.id);
  await expect(
    page.getByText("Không phân tích được nội dung nguồn", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Loại vấn đề chất lượng")
    .selectOption("MISSING_SUMMARY");
  await expect(
    page.getByText("Không có tóm tắt", { exact: true }),
  ).toBeVisible();
});

test("watchlist alerts baseline, apply conditions and persist a single unread notice", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "finance-radar.library.v1",
      JSON.stringify({
        searches: [],
        watches: [
          {
            id: "watch-1",
            name: "Vingroup",
            topicIds: ["vingroup"],
            watchedSourceIds: [],
            keywords: [],
            seenAt: "2026-09-24T00:00:00Z",
          },
        ],
      }),
    ),
  );
  let fired = false;
  let condition: unknown;
  await page.route("**/api/alerts/check", (r) => {
    const body = r.request().postDataJSON();
    if (!body.since)
      return r.fulfill({
        json: {
          checkedThrough: "2026-09-24T01:00:00Z",
          count: 0,
          triggered: false,
          articles: [],
        },
      });
    if (!fired) {
      fired = true;
      condition = body;
      return r.fulfill({
        json: {
          checkedThrough: "2026-09-24T02:00:00Z",
          count: 2,
          triggered: true,
          articles: [article],
        },
      });
    }
    return r.fulfill({
      json: {
        checkedThrough: "2026-09-24T03:00:00Z",
        count: 0,
        triggered: false,
        articles: [],
      },
    });
  });
  await page.goto("/#alerts");
  await page.getByLabel("Bật cảnh báo Vingroup").check();
  await page.getByLabel("Ngưỡng Vingroup").fill("2");
  await page.getByLabel("Điều kiện Vingroup").fill("đầu tư");
  await page.getByRole("button", { name: "Lưu cảnh báo Vingroup" }).click();
  await expect(
    page.getByRole("heading", { name: /Vingroup · 2 tin mới/ }),
  ).toBeVisible();
  expect(condition).toMatchObject({
    minimum: 2,
    filter: { topicIds: ["vingroup"], q: "đầu tư" },
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Vingroup · 2 tin mới/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Đánh dấu đã đọc Vingroup" }).click();
  await expect(page.getByText("Chưa đọc", { exact: true })).toHaveCount(0);
});

test("coverage compares sources and curation submits only selected articles with a reason", async ({
  page,
}) => {
  const second = {
    ...article,
    id: "article-2",
    sourceId: "source-2",
    sourceName: "Nguồn đối chiếu",
    title: "Góc nhìn thứ hai",
    url: "https://example.com/second",
  };
  await page.route("**/api/stories/*/coverage", (r) =>
    r.fulfill({
      json: {
        storyId: article.id,
        total: 2,
        sources: [
          {
            sourceId: article.sourceId,
            sourceName: article.sourceName,
            topics: ["Lãi suất"],
            articles: [article],
          },
          {
            sourceId: second.sourceId,
            sourceName: second.sourceName,
            topics: ["FPT"],
            articles: [second],
          },
        ],
      },
    }),
  );
  await page.route("**/api/stories/curate", (r) =>
    r.fulfill({ json: { targetStoryId: "new-story" } }),
  );
  await page.goto("/#articles");
  await page
    .getByRole("button", { name: /Xem Story/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Compare Coverage", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Nguồn đối chiếu", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: second.title, exact: true }),
  ).toHaveAttribute("href", second.url);
  await dialog
    .getByRole("button", { name: "Chỉnh Story", exact: true })
    .click();
  await dialog
    .getByRole("checkbox", { name: `Chọn ${second.title}`, exact: true })
    .check();
  await dialog.getByLabel("Lý do chỉnh").fill("Khác sự kiện");
  const mutation = page.waitForRequest((r) =>
    r.url().endsWith("/stories/curate"),
  );
  await dialog.getByRole("button", { name: "Áp dụng chỉnh Story" }).click();
  expect((await mutation).postDataJSON()).toEqual({
    articleIds: [second.id],
    targetStoryId: null,
    expectedStoryId: article.id,
    reason: "Khác sự kiện",
  });
  await expect(dialog.getByRole("status")).toContainText("tách sang Story mới");
});

test("entity graph saves cited relationships and exposes directions", async ({
  page,
}) => {
  await page.route("**/api/topics", (r) =>
    r.fulfill({
      json: [
        { id: "fpt", name: "FPT", kind: "ENTITY", articles: 1 },
        { id: "person", name: "Nguyễn Văn A", kind: "ENTITY", articles: 0 },
      ],
    }),
  );
  let saved = false;
  await page.route("**/api/entities/relationships**", (r) => {
    if (r.request().method() === "POST") {
      saved = true;
      return r.fulfill({ json: { id: "relation-1" } });
    }
    return r.fulfill({
      json: saved
        ? [
            {
              id: "relation-1",
              fromId: "fpt",
              fromName: "FPT",
              toId: "person",
              toName: "Nguyễn Văn A",
              relation: "CEO",
              evidence: article.summary,
              article,
              createdAt: article.collectedAt,
            },
          ]
        : [],
    });
  });
  await page.goto("/#entities");
  await page.getByText("Thêm quan hệ có dẫn chứng", { exact: true }).click();
  await page.getByLabel("Entity nguồn", { exact: true }).selectOption("fpt");
  await page.getByLabel("Entity đích", { exact: true }).selectOption("person");
  await page.getByRole("radio").first().check();
  await page.getByLabel("Trích dẫn nguyên văn").fill(article.summary);
  const mutation = page.waitForRequest(
    (r) => r.url().endsWith("/entities/relationships") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Lưu quan hệ", exact: true }).click();
  expect((await mutation).postDataJSON()).toMatchObject({
    fromId: "fpt",
    toId: "person",
    relation: "CEO",
    articleId: article.id,
    evidence: article.summary,
  });
  await expect(page.locator(".entity-edge")).toContainText("FPT");
  await expect(page.locator(".entity-edge")).toContainText("Nguyễn Văn A");
  await expect(page.locator("blockquote")).toHaveText(article.summary);
});

test("personal feed persists interests and keeps reading history opt-in and erasable", async ({
  page,
}) => {
  await page.route("**/api/feed/personalized", (r) =>
    r.fulfill({
      json: {
        items: [
          {
            storyId: article.id,
            article,
            score: 11,
            reasons: ["FPT"],
            read: false,
          },
        ],
        total: 1,
        page: 0,
        size: 15,
      },
    }),
  );
  await page.goto("/#personal");
  await page.getByRole("checkbox", { name: "FPT", exact: true }).check();
  await page
    .getByRole("checkbox", {
      name: "Dùng và lưu lịch sử mở bài trên trình duyệt này",
    })
    .check();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "FPT", exact: true }),
  ).toBeChecked();
  await page.getByRole("link", { name: "Dòng thông tin", exact: true }).click();
  await page.getByRole("button", { name: article.title, exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Dành cho bạn", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Xóa lịch sử đọc (1)" }),
  ).toBeVisible();
  const request = page.waitForRequest(
    (r) =>
      r.url().endsWith("/feed/personalized") &&
      r.postDataJSON().readIds.length === 0,
  );
  await page.getByRole("button", { name: "Xóa lịch sử đọc (1)" }).click();
  await request;
  await expect(
    page.getByRole("button", { name: "Xóa lịch sử đọc (0)" }),
  ).toBeVisible();
});
