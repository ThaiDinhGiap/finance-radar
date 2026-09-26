# Finance Radar frontend

## Product and direction

A Vietnamese reading and research workspace for public economic and financial news. The primary flow is search/filter → read summary → inspect the original source. Source configuration and collection logs support that flow. AI answers use retrieved headlines/summaries and verifiable citations, not a market-price feed.

Use a calm light working surface, a dark navigation rail, restrained teal actions, compact metadata and tabular numeric values. Do not add price charts, trends or confidence scores without real API data. Keep source category, published date and collected date distinct. Keep the AI scope and disclosure visible.

## Research used

- shadcn MCP: `sidebar-01`, grouped navigation and active-page state; component audit checklist.
- https://ui.shadcn.com/blocks/sidebar — persistent navigation and content inset.
- https://21st.dev/community/components/s/sidebar — fixed/collapsible panels, active state and mobile behavior. Accessed through Firecrawl because this session exposed no 21st.dev MCP tools.
- https://21st.dev/community/components/explore/sidebar-ui — compared dashboard sidebar patterns. Rejected animated and deeply nested navigation for a four-view application.

The root DESIGN.md is an editorial reference, not a requirement to make the working application a magazine. This implementation reduces masthead/hero space and gives operational data and reading controls priority.

## Existing patterns retained

Feature folders, shared API client, resource polling and chat hook remain intact. Shared `Modal` keeps its public interface and composes the installed shadcn/Base UI Dialog. `LoadingState` composes the existing Skeleton for consistent asynchronous feedback. The header uses the existing Button. Pagination and native forms remain shared/accessibly labelled.

Legacy text colors use `--text-muted` and `--brand`; shadcn `--muted` and `--accent` remain background tokens. This prevents the original foreground/background naming collision. All feature colors come from the theme. Styles remain in the existing stylesheet; no inline styles or new UI framework.

## Validation

- `npm run lint`: TypeScript/React hooks/accessibility lint. Registry wrappers have narrow a11y exceptions because labels/content are forwarded as props; feature usages remain checked.
- `npm run lint:shadcn`: no arbitrary Tailwind values, raw colors or inline styles in app/feature/shared code. Generated primitives retain their upstream utility patterns.
- `npm run typecheck`, `npm run build`, `npm run format:check`.
- `CHROME_BIN=/usr/bin/google-chrome npm run test:ui`: eight Playwright interaction tests with mocked API responses, including source payloads, pagination, dialog focus, citations, failure states, and 320px accessibility checks. Without CHROME_BIN, Playwright uses its installed Chromium.
- `node qa/inspect.mjs`: read-only screenshots and axe checks against the local data stack on port 5174 (override BASE_URL). Requires seeded sources/articles/runs. Screenshots are ignored by Git.

Desktop (1440px) and mobile (390px) live data screenshots were inspected. The mobile refinement removes irrelevant summary cards from AI/log views and collapses article filters. Automated axe checks supplement visual and keyboard testing; they do not establish complete WCAG conformance. Live AI generation and source mutations are intentionally exercised using mocks in regression tests, not by spending API credits or changing the user's source configuration.
