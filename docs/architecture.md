# Thiết kế kiến trúc

## Quyết định chính

Modular monolith chia theo domain/application/infrastructure/web, triển khai một backend và một frontend. Phạm vi hiện tại là một bounded context: thu thập và đọc thông tin. Không tách microservices trước khi xuất hiện nhu cầu scale hoặc ownership độc lập.

Domain chứa model thuần Java, không ORM/JDBC/HTTP/Spring. Application định nghĩa các port và điều phối use case. Infrastructure triển khai persistence, đọc RSS/HTML/API, HTTP và chuẩn hóa. Web làm validation DTO và gọi application/port; không chứa SQL hoặc logic crawl.

Application sử dụng annotation Spring cho DI và transaction: lựa chọn thực dụng, không tuyên bố framework-free Clean Architecture tuyệt đối. Dependency direction được kiểm tra bằng ArchUnit.

## SOLID và các pattern thực sự sử dụng

- **Strategy**: `FeedConnector` có RSS, HTML, Mastodon implementations. Worker chọn theo `Source.Kind`, map được DI từ danh sách connector. Không dùng switch khổng lồ để xử lý nguồn.
- **Ports/Adapters, Dependency Inversion**: use case phụ thuộc `SourceRepository`, `ArticleRepository`, `RunRepository`, `ContentPolicy`, `FeedConnector`; không phụ thuộc JDBC/Jsoup/ROME.
- **Interface Segregation**: mỗi port phục vụ một nhóm hành vi; JDBC adapter dùng chung mapping nhưng caller nhận interface hẹp.
- **Repository**: persistence tập trung trong `JdbcCatalogRepository`; SQL parameterized, không ghép input vào SQL.
- **Transaction Script / application service**: `CrawlTransactions` đóng gói enqueue, complete, fail. Không tạo các abstraction chung như `BaseService<T>` chỉ để đủ pattern.
- **Single Responsibility**: fetcher xử lý HTTP/robots; connector diễn giải payload; content policy chuẩn hóa; transaction service đảm bảo commit; UI chia theo feature và reuse shared primitives.

Model CRUD hiện tại đơn giản nên dùng immutable records, không dựng aggregate DDD phức tạp hoặc event bus nội bộ chưa cần thiết. Thêm một connector mới cần implementation + enum + DB check migration + form option + test; không tuyên bố thêm mọi nguồn là hoàn toàn không sửa code.

## Luồng xử lý và tính nhất quán

1. Người quản trị tạo/cập nhật nguồn. Backend xác minh HTTPS, cấu hình và CSS selectors. Nguồn mới tạm dừng; URL chưa được coi là hoạt động cho đến khi crawl thành công.
2. Scheduler hoặc API tạo job: trong một transaction, CAS `sources.active_run_id IS NULL` lấy quyền sở hữu nguồn rồi insert `crawl_runs=QUEUED`. Nếu conflict thì trả 409.
3. Worker CAS `QUEUED -> RUNNING`; mỗi job chỉ có một worker thắng. HTTP chạy ngoài transaction DB.
4. Fetcher xác minh robots trước đường dẫn mục tiêu, resolve DNS trong HTTP connection manager, chặn mọi IP private/reserved; không cho thư viện tự resolve lại qua resolver khác. Không theo redirect; lỗi yêu cầu sửa URL.
5. Connector parse tối đa 100 mục. Normalizer loại markup, chuẩn hóa URL; mục không hợp lệ bị đếm rejected.
6. Transaction complete khóa dòng nguồn với `FOR UPDATE`, xác minh `active_run_id` đúng token. Insert articles bằng `ON CONFLICT(url_hash) DO NOTHING`; ghi kết quả rồi giải phóng nguồn và đặt lần chạy tiếp theo. Tất cả cùng commit hoặc rollback.
7. Nếu thất bại, transaction riêng đánh FAILED, tăng failures và backoff. Job quá 10 phút được đánh lỗi khi scheduler kiểm tra; quyền sở hữu bị gỡ. Completion cũ mất token không được ghi dữ liệu.

Scheduler và worker dùng một scheduling thread mặc định, do đó recovery chờ lượt HTTP hiện tại xong. Các request có deadline/bounded body; workload bị treo bất thường cần restart process. Không bảo đảm chính xác từng giây. Bản đầu ưu tiên ít request và vận hành đơn giản.

## Chống trùng và tìm kiếm

Khóa trùng là SHA-256 của URL đã bỏ fragment và các query tracking đã biết. Đây là trùng URL toàn hệ thống, không phải semantic dedup. Bài giống nội dung trên URL khác vẫn giữ. Khi nhiều nguồn dẫn cùng URL, article giữ nguồn insert đầu tiên; chưa có bảng nhiều provenance. Nội dung bài cũ không được tự cập nhật sau insert.

PostgreSQL GIN trên `to_tsvector('simple',title || ' ' || summary)`, query `plainto_tsquery`. Hỗ trợ token tiếng Việt và tiếng Anh, không có Vietnamese stemming, typo tolerance, unaccent hay dịch ngôn ngữ. Tìm không dấu có thể không khớp có dấu.

## Mở rộng khi có nhu cầu thật

Tách worker deployment khi throughput là nút thắt, sau đó thêm limiter theo host dùng DB/Redis, queue retry chuyên dụng và fair scheduling. Nếu cần thu thập lịch sử thì thêm cursor/pagination/checkpoint theo connector, không dùng cùng batch RSS đầu trang. Khi có lượng bài và nhu cầu ranking lớn, cân nhắc search engine riêng sau khi đo PostgreSQL.

Tích hợp mạng xã hội có xác thực bằng adapter riêng, credentials ở secret manager/env qua alias, tuyệt đối không nhét token vào URL nguồn được API trả ra. Chưa có token management UI, OAuth hoặc credential vault trong bản này.

## RAG chat

Chat sử dụng pipeline riêng: ArticleChunker → EmbeddingModel → VectorRepository (pgvector) → SemanticRetrieval → AnswerModel → CitationVerifier. Các port được triển khai trong infrastructure; crawler và transaction lưu bài hiện có được giữ nguyên. Indexer xử lý cả bài cũ và mới, có lease/fingerprint và atomic chunk replacement. Xem [AI chat](ai-chat.md) để biết hợp đồng, trade-off, giới hạn và cách kích hoạt. Bộ tìm kiếm từ khóa của Dòng thông tin ở trên không dùng để thay thế semantic retrieval.
