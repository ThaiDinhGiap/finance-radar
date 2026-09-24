# Kết quả kiểm chứng · cập nhật 21/09/2026

## Build và kiểm thử tự động

- Backend Spring Boot 4.1.1 / Java 17: `mvn spotless:apply test` thành công.
- 39 tests, 0 failure, 0 error, 0 skipped: 10 parser/content, 12 PostgreSQL/API integration, 8 chat/citation, 5 RAG components, 3 provider answer adapter, 1 architecture.
- PostgreSQL 17 + pgvector 0.8.2 thật trong Testcontainers, database riêng với ứng dụng.
- Các ca kiểm tra: RSS/Atom, XML DOCTYPE bị từ chối, HTML relative URL/selectors, Mastodon JSON/error payload, sanitize/URL dedup/SSRF address classification; duplicate concurrent enqueue, atomic completion, rollback sau insert đầu tiên, stale completion, backoff, expired run, disabled source, edit-active-source conflict, public reads, write authorization, invalid input, create/update/enable/enqueue qua HTTP.
- Frontend `npm run build` thành công (TypeScript strict + Vite).
- `npm run format:check` thành công.
- npm audit sau cập nhật dependency: 0 vulnerabilities tại thời điểm kiểm tra. Đây không phải chứng nhận an toàn toàn hệ thống; backend chưa chạy dependency vulnerability scanner.
- `docker compose up -d --build` thành công: PostgreSQL + Java + Nginx/React đều chạy local.

## Dữ liệu thật

Lượt đầu: VnExpress 60 bài, Tuổi Trẻ 50, BBC 53 bài mới/54 mục, Federal Reserve 20, ECB 15: tổng 198 bài. Mastodon thêm 20 bài: tổng 218.

Chạy lại VnExpress: 60 mục, 0 bài mới, không nhân đôi dữ liệu. Restart containers giữ nguyên dữ liệu PostgreSQL.

Đã sửa và kiểm thử hồi quy URL có URL lồng trong path (ví dụ dịch vụ bridge), giữ nguyên slash và thứ tự query lặp. Một URL trong dữ liệu thử đã được sửa và tính lại hash sau khi phát hiện.

Reddit: FAILED do robots.txt không cho phép. Economics Stack Exchange: FAILED do robots.txt HTTP 403. Đã tạm dừng cả hai và giữ nhật ký để phản ánh giới hạn thực tế. Không bypass.

## Kiểm tra trực tiếp trong trình duyệt

- Trang danh sách hiển thị dữ liệu thật từ API.
- Lọc tiếng Việt trả 110 bài từ hai nguồn Việt Nam.
- Mở/đóng dialog chi tiết, có nguồn gốc, tóm tắt và link gốc.
- Tìm từ khóa không tồn tại hiển thị trạng thái rỗng; xóa bộ lọc phục hồi danh sách.
- Xem quản lý nguồn, mở menu mobile, mở form chỉnh sửa với giá trị hiện tại.
- Chưa nhập khóa thì thêm nguồn yêu cầu khóa; khóa sai bị server từ chối với lỗi hiển thị trong form.
- Kiểm tra bố cục mobile khoảng 400px và desktop bằng browser viewport.
- Nhật ký hiển thị đủ SUCCESS/FAILED, số bài trùng và lỗi robots của nguồn thật.
- Health cuối cùng UP; Nginx proxy API trả 218 bài, 8 nguồn, 6 nguồn đang bật.

Chưa có bộ UI regression tự động, load test, accessibility audit toàn diện, TLS public deployment hay rà soát điều kiện sử dụng thương mại cho từng nguồn. HTML/Mastodon có fixture tests; chỉ Mastodon và RSS nguồn được liệt kê ở trên đã thử upstream thật.

## RAG chat · 21/09/2026

- Vector search chạy trên pgvector thật: cosine similarity/threshold, source/language/date filters, model/version separation, loại SOCIAL, nội dung thay đổi bị loại trước khi reindex.
- Claim lease hết hạn được lấy lại; completion với token cũ bị từ chối. Một batch có vector sai kích thước rollback toàn bộ chunks, giữ khả năng retry.
- Chunking giới hạn kích thước, overlap và tái ghép đủ nội dung. Embedding adapter kiểm tra payload, thứ tự index, dimensions, vector zero/không hợp lệ. Index lỗi không publish batch một phần.
- Chat không có evidence không gọi generation; thiếu khóa/index chưa sẵn sàng không fallback từ khóa. Citation kiểm tra ID, exact quote trong retrieved chunks (không chấp nhận quote từ phần khác của cùng bài), abstention và giới hạn concurrency.
- Responses adapter gửi đúng chunks, structured output, store=false; không cấp web search hoặc nội dung bài chưa retrieve. Từ chối output malformed/incomplete.
- Build Java, TypeScript/Vite và Prettier check đạt. Docker stack đã cập nhật extension trên volume cũ; có bản pg_dump local trước cập nhật. Health UP, dữ liệu crawl giữ nguyên và scheduler tiếp tục thêm bài.
- Snapshot `/api/chat/status`: 278 bài NEWS/INSTITUTION, 5 nguồn, ready=0, pending=278, chunks=0, configured=false vì chưa có OPENAI_API_KEY. Tổng feed lúc kiểm tra 309 bài gồm social. Các số tiếp tục thay đổi theo scheduler.
- Browser: vào AI đọc tin qua menu mobile, gợi ý điền câu hỏi, hướng dẫn kích hoạt mở được, sidebar hiển thị tiến độ index và bộ lọc; hai nút tìm/hỏi AI bị vô hiệu khi chưa có khóa/vector. Bố cục mobile đọc được, không tràn ngang ở viewport kiểm tra.
- **Chưa gọi OpenAI thật**, theo yêu cầu người dùng thêm khóa sau. Vector fixture chỉ chứng minh cơ chế truy xuất, không đánh giá chất lượng embedding ngôn ngữ; HTTP model được mock trong test. Chưa kiểm thử chất lượng trả lời end-to-end với provider thật hoặc đánh giá threshold trên tập câu hỏi chuẩn. Cần kiểm chứng bước này sau khi cấu hình khóa.

## Chuyển sang OpenRouter · 21/09/2026

- Provider OpenRouter; model trả lời `inclusionai/ling-3.0-flash-vl:free`, embedding `openai/text-embedding-3-small` (1.536 chiều), credential chỉ trong `.env` backend.
- Model chat không hỗ trợ response_format: gửi Chat Completions không streaming với prompt/schema JSON; parse content cuối, bỏ qua reasoning, từ chối lỗi provider, output bị cắt hoặc thiếu trường. CitationVerifier tiếp tục kiểm tra quote/nguồn.
- 39 tests hiện tại đạt, 0 failures/errors/skipped. Tests provider được chuyển sang Chat Completions; đã kiểm tra JSON fence, refusal, trường bắt buộc, context đúng chunks và không gửi tham số response_format không được hỗ trợ. TypeScript/Vite build và Prettier check đạt.
- **Gọi embedding thật thành công**, HTTP 200, vector dài 1.536.
- **RAG end-to-end thật thành công** với câu hỏi “Các bản tin nói gì về lãi suất?”: HTTP 200, ANSWERED, 1 statement và 1 nguồn được CitationVerifier chấp nhận. Lúc bắt đầu test có 5 bài READY; snapshot sau đó 10 READY, 268 pending, 0 failed. Indexer tiếp tục chạy nền; các số không cố định.
- Đây là smoke test vận hành, không phải đánh giá độ chính xác toàn diện. Các ghi chú chưa có khóa/OpenAI chưa gọi ở mục trước mô tả trạng thái lịch sử trước lần chuyển provider này.

## File khóa bên ngoài project

Khóa được chuyển sang `~/.config/OpenRouter key/.env` (thư mục 700, file 600). Project `.env` chỉ giữ OPENROUTER_ENV_FILE; backend nạp qua Docker Compose env_file, đã bỏ environment override rỗng. Kiểm tra giá trị trong container khớp file ngoài mà không in khóa. Trạng thái provider OpenRouter configured=true, snapshot 284 ready / 0 pending / 0 failed. Compose config --quiet và frontend build đạt.

## Thiết kế lại frontend theo phong cách báo kinh tế · 21/09/2026

- Tham khảo [Economist.com redesign](https://www.manuka.media/economist-redesign), [Ghost Headline](https://ghost.org/themes/headline/) và [Newspaper](https://explore.ghost.org/p/newspaper): masthead, tiêu đề serif, phân cấp bài viết, đường phân cột và điều hướng theo chuyên mục. Finance Radar dùng nhận diện riêng, nền giấy sáng và điểm nhấn đỏ; không sao chép tài sản hay cài theme ngoài.
- Giữ kiến trúc React theo feature, API client, `useResource`, `useChat`, `Modal`, `Pagination` và Lucide. CSS variables thống nhất cả dòng tin, nguồn dữ liệu, nhật ký, AI và form; không thêm dependency. Modal bổ sung khôi phục focus về phần tử mở sau khi đóng.
- Dòng tin có bố cục báo / danh sách gọn, bộ lọc, chọn nguồn từ cột phụ và đường dẫn sang AI. Bài đầu là bài mới thu thập theo thứ tự API, không gắn nhãn xu hướng hay độ quan trọng khi chưa có dữ liệu hỗ trợ.
- `npm run build` và `npm run format:check` đạt. Kiểm tra trình duyệt Chrome headless với API local thật: 35 kiểm tra đạt, không có lỗi JavaScript runtime; bao gồm phân trang, tìm kiếm không kết quả, lọc ngôn ngữ, chọn nguồn, loại tin, bài chi tiết, Escape/focus, form HTML/Mastodon, điền sẵn form sửa nguồn, nhật ký, gợi ý câu hỏi, phạm vi AI và giữ câu hỏi khi chuyển màn hình.
- Bốn màn hình được kiểm tra ở 1440, 768, 390 và 320 px, không tràn ngang toàn trang. Bảng nhật ký cuộn trong vùng riêng trên mobile. Đã xem ảnh desktop/mobile; sửa lỗi đoạn tóm tắt chứa chuỗi dài tràn màn hình nhỏ.
- Mô phỏng HTTP 503 riêng trong trình duyệt để kiểm tra thông báo lỗi và khôi phục bằng Làm mới. Đây là smoke test có mục tiêu, không phải accessibility audit toàn diện. Không gửi câu hỏi đến provider AI, không lưu/sửa nguồn hay kích hoạt crawler trong lượt kiểm tra UI này; các nghiệp vụ backend giữ nguyên.
- Script kiểm tra, ảnh và kết quả tạm nằm trong `.local/ui-review/`, không thuộc mã ứng dụng.
