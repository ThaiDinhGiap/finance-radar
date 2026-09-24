# Finance Radar

Website thu thập và tra cứu thông tin kinh tế–tài chính. Backend Java 17 / Spring Boot 4.1, frontend React 19 / TypeScript, PostgreSQL 17. Giao diện tiếng Việt, dữ liệu thật từ backend, không chứa bài viết mẫu giả lập.

## Chạy nhanh bằng Docker

Yêu cầu Docker Engine và Docker Compose v2. Tại thư mục project:

```sh
cp .env.example .env
# Sửa DB_PASSWORD và thông tin liên hệ trong RADAR_USER_AGENT khi triển khai riêng.
docker compose up -d --build
```

Nếu `.env` đã tồn tại thì giữ nguyên hoặc sửa trực tiếp, không chép đè. Bản đã khởi tạo có sẵn cấu hình local trong `.env`.

- Website: http://localhost:5173
- API: http://localhost:8080/api/sources
- Health: http://localhost:8080/actuator/health
- PostgreSQL cho công cụ local: localhost:55432 / database `finance_radar` / user `radar`.

Sau khi khởi động, scheduler đưa nguồn đã bật vào hàng đợi trong khoảng 15–30 giây. Dữ liệu xuất hiện khi từng nguồn được xử lý; nếu không tải được, xem **Nhật ký thu thập**. Mặc định có năm nguồn RSS được bật và hai cấu hình diễn đàn/mạng xã hội tạm dừng.

Mở **Nguồn dữ liệu** để thêm/sửa nguồn, bật/tạm dừng hoặc chạy thủ công. Quản lý nguồn và AI chat sử dụng trực tiếp, không yêu cầu khóa quản trị. Các cổng Docker vẫn chỉ bind localhost.

## Chức năng đã triển khai

- Thu thập RSS/Atom; HTML trang danh sách qua CSS selectors; Mastodon hashtag/public API trả danh sách status.
- Nguồn báo chí, tổ chức kinh tế, diễn đàn và mạng xã hội được phân loại riêng.
- Thêm/sửa nguồn, URL, ngôn ngữ, khu vực, chu kỳ 15 phút–7 ngày; nguồn mới mặc định tạm dừng.
- Hàng đợi PostgreSQL; một lượt hoạt động trên mỗi nguồn; worker xử lý nền, không giữ giao dịch trong lúc HTTP.
- Lịch chạy từng nguồn, chạy thủ công, nghỉ tối thiểu 60 giây giữa hai lượt cùng nguồn.
- Retry theo lịch với backoff 15, 30, 60, 120, 240 phút; phục hồi job quá 10 phút.
- Lưu tiêu đề, tóm tắt, URL gốc, thời gian xuất bản nếu nguồn cung cấp, thời gian thu thập.
- Chuẩn hóa URL, bỏ tham số tracking phổ biến và fragment; SHA-256 + UNIQUE để chống trùng URL toàn hệ thống.
- Làm sạch HTML thành plain text; tối đa 100 mục/lượt, tải tối đa 2 MB/request.
- Tìm kiếm toàn văn PostgreSQL `simple`, lọc nguồn/ngôn ngữ/loại, phân trang ổn định theo thời gian thu thập + ID.
- Nhật ký trạng thái, số mục đọc/bài mới/mục không hợp lệ, lỗi upstream; thống kê từ DB.
- robots.txt fail-closed, DNS resolver chống SSRF, HTTPS cổng 443, không tự theo redirect, timeout, giới hạn tốc độ.
- Responsive desktop/mobile, loading/empty/error states, dialog điều khiển bằng bàn phím.
- AI chat RAG: chia đoạn → OpenRouter Embeddings → pgvector → semantic retrieval → OpenRouter trả lời có dẫn chứng. Lập chỉ mục nền, hiển thị tiến độ, kiểm tra quote và nguồn trước khi hiển thị.

Xem [kích hoạt và thiết kế RAG](docs/ai-chat.md). Khóa `OPENROUTER_API_KEY` nằm trong file `~/.config/OpenRouter key/.env`, được trỏ tới bằng `OPENROUTER_ENV_FILE` trong `.env` của project. Sau khi cập nhật khóa, chạy `docker compose up -d backend`, chờ chỉ mục sẵn sàng rồi mở **AI đọc tin**. Khóa OpenRouter chỉ ở backend.

## Kiến trúc

**Modular monolith có phân lớp và ports/adapters.** Chưa cần microservices, Kafka, Redis hay Elasticsearch để vận hành giai đoạn này. PostgreSQL phục vụ cả dữ liệu và hàng đợi bền vững.

```text
finance-radar/
├── backend/
│   └── src/main/
│       ├── java/vn/financeradar/
│       │   ├── domain/                  # Java records, enum; không phụ thuộc Spring
│       │   ├── application/             # Use cases, worker orchestration, transaction boundary
│       │   │   └── port/                # Repository, connector, content policy interfaces
│       │   ├── infrastructure/
│       │   │   ├── ai/                  # OpenRouter embeddings và chat completions
│       │   │   ├── crawl/               # HTTP, robots, RSS, HTML, Mastodon, normalization
│       │   │   ├── persistence/         # JDBC adapter
│       │   │   └── config/              # Security
│       │   └── web/                     # REST DTOs, validation, exception handling
│       └── resources/db/migration/      # Flyway
├── frontend/src/
│   ├── features/articles/              # Dòng tin và chi tiết
│   ├── features/sources/               # Danh sách, tạo/sửa nguồn
│   ├── features/chat/                  # RAG chat, nguồn trích dẫn, trạng thái index
│   ├── features/runs/                  # Nhật ký
│   └── shared/                         # API client, types, hooks, dialog, pagination
├── docs/
└── compose.yml
```

Xem [thiết kế và trade-off](docs/architecture.md), [hợp đồng API](docs/api.md), [vận hành](docs/operations.md), [nguồn và giới hạn](docs/sources.md), [kết quả kiểm chứng](docs/verification.md).

## Chạy để phát triển

Yêu cầu JDK 17+, Maven 3.6.3+, Node.js 24+, Docker. Nếu đang chạy cả stack Docker, dừng hai container app để giải phóng cổng, giữ DB:

```sh
docker compose stop frontend backend
docker compose up -d db
```

Terminal backend (nạp biến trong `.env` project và file khóa bên ngoài do `OPENROUTER_ENV_FILE` trỏ tới bằng công cụ shell/IDE của bạn):

```sh
cd backend
mvn spring-boot:run
```

Giá trị DB mặc định khớp local Compose. Nếu đã đổi mật khẩu trong `.env`, truyền `DB_PASSWORD` tương ứng cho backend. Tắt việc tự enqueue bằng `RADAR_SCHEDULER_ENABLED=false`; job thủ công vẫn chạy.

Terminal frontend:

```sh
cd frontend
npm ci
npm run dev
```

Vite proxy `/api` đến backend tại `127.0.0.1:8080`; không nhúng khóa OpenRouter vào bundle.

## Kiểm thử

```sh
cd backend
mvn test
mvn spotless:check
# Trước khi test lần đầu, từ project root chạy: docker compose build db
# Cần Docker để Testcontainers tạo PostgreSQL/pgvector riêng, không dùng DB ứng dụng.
```

```sh
cd frontend
npm ci
npm run build
npm run format:check
```

Kiểm thử luồng REST chạy trong `PipelineIntegrationTest` với PostgreSQL riêng. Giao diện được kiểm tra trực tiếp bằng trình duyệt; xem checklist và phạm vi tại `docs/verification.md`. Chưa có bộ regression UI tự động.

## Giới hạn của bản đầu

Đây là ứng dụng chạy được trọn luồng, nhưng chưa phải nền tảng crawl không giới hạn mọi website. Không vượt paywall/CAPTCHA, không thu thập tài khoản riêng tư, không hỗ trợ X/Facebook/LinkedIn khi chưa có API/quyền truy cập. Nội dung JavaScript cần trình duyệt chưa được render; HTML chỉ lấy một trang danh sách. Mỗi lượt RSS/API tối đa 100 mục, chưa backfill lịch sử hay phân trang remote. Không tự chấm độ tin cậy, phân tích cảm xúc hoặc tư vấn đầu tư.

Triển khai mặc định cho một backend instance; DB lock bảo vệ job khi chạy đồng thời nhưng limiter theo host đang nằm trong bộ nhớ. Đọc [vận hành](docs/operations.md) trước khi mở truy cập công khai hoặc tăng số replica. Không có tuyên bố hiệu năng hay khả năng chịu tải production khi chưa load test.
