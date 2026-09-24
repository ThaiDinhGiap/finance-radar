# Finance Radar conventions

- Read README.md and docs/architecture.md before changing code.
- Domain is pure Java. Application depends on ports; never import infrastructure into application or web.
- Reuse shared React hooks, Modal, Pagination, API client and CSS variables. No inline styles or new UI libraries without a concrete need.
- Crawled-content network fetches must go through SafeHttpFetcher. Do not bypass SSRF validation, robots checks, body limits or timeouts.
- AI requests use OpenRouterHttpTransport with its fixed HTTPS endpoints for Chat Completions and Embeddings, public DNS validation, response size/deadline limits and no redirects. Never pass user URLs or keys through this adapter.
- Never hold a DB transaction during HTTP. Preserve active_run_id fencing and atomic article/run completion.
- Add a Flyway migration instead of changing migrations already deployed.
- Use the existing connector strategy for new source formats. A source requiring credentials needs a separate explicit design; never put secrets in source URLs.
- Backend: docker compose build db, then mvn test (Docker required). Frontend: npm run build and npm run format:check; inspect core UI flows against the local stack.
- Do not commit, push, deploy publicly, expose database ports, or delete Docker volumes automatically.
