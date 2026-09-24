# Vận hành

## Triển khai

`docker compose up -d --build` chạy PostgreSQL, Java backend và Nginx phục vụ bundle React. Các cổng chỉ bind loopback. Nếu cần public, đặt reverse proxy HTTPS có authentication/rate limiting ở trước; không đổi cổng DB sang `0.0.0.0`.

Java container chạy user không phải root. Frontend không chứa secret. API đọc/ghi và chat không yêu cầu khóa quản trị; đây là mô hình single-operator, chưa có user accounts, RBAC hay audit danh tính người thao tác. Đặt SSO gateway/VPN trước UI nếu nguồn và thống kê cần riêng tư.

Kiểm tra `.env` không vào source control. Không xuất API key vào URL, access log hoặc ảnh chụp. Sửa `RADAR_USER_AGENT` để có thông tin liên hệ thực. Đổi `DB_PASSWORD` trong `.env` không tự đổi password của DB volume đã tạo: cần rotate DB credential bằng quy trình quản trị PostgreSQL và cập nhật app đồng bộ.

## Quan sát và xử lý lỗi

```sh
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```

- HTTP 403/429, robots disallow: xem điều kiện truy cập hoặc dùng feed/API được phép. Không đổi sang trình giả người dùng để vượt chặn.
- URL chuyển hướng: mở **Sửa nguồn**, cập nhật endpoint chính thức cuối cùng rồi chạy lại.
- HTML không có mục: DOM có thể thay đổi; sửa selectors. Nội dung tải bằng JavaScript cần adapter browser riêng, chưa hỗ trợ.
- XML không hợp lệ: endpoint có thể đang trả HTML/challenge thay feed. Xem nguồn gốc trực tiếp.
- `RUNNING` treo: sau >10 phút scheduler sẽ đánh lỗi khi thực thi vòng kiểm tra tiếp theo; crash/restart vẫn giữ trạng thái DB.
- Failed jobs retry theo lịch; không có vòng retry nhanh trong HTTP client. `Retry-After` chưa được diễn giải riêng, backoff theo policy ứng dụng.
- Nguồn trả 0 mục được ghi SUCCESS với thông báo rõ; không bảo đảm publisher có tin mới.

Backoff hiện tại tối đa 240 phút, reset failures khi thành công. Không tự disable nguồn khi lỗi nhiều lần; quản trị có thể pause.

## Bảo vệ outbound

Fetcher chỉ HTTPS 443; chặn credentials trong URL; resolve DNS qua resolver kiểm tra public IP ngay lúc mở socket; không redirects; timeout kết nối/đọc, deadline khi đọc body và limit 2 MB sau giải nén. robots.txt 404/410 được xem là không có chỉ dẫn; 401/403/429/5xx và lỗi mạng fail-closed. Khoảng cách request theo host tối thiểu 2 giây, crawl-delay hỗ trợ đến 30 giây.

robots.txt không thay thế quyền sử dụng dữ liệu. Đọc terms/license của từng nguồn khi xuất bản lại hoặc phục vụ thương mại. Website chỉ lưu tóm tắt do nguồn cung cấp và dẫn link gốc; giới hạn 1500 ký tự không tự động tạo quyền sao chép.

Triển khai một backend replica cho limiter hiện tại. Database job lock chống xử lý trùng giữa các replica nhưng không điều phối per-host delay giữa máy. Production nên thêm egress firewall chặn private networks và rate limit đầu vào, policy allowlist nguồn nếu nhiều người quản trị. Chưa có per-user quotas hoặc nguồn vô hạn.

## Dữ liệu và backup

Volume `finance-radar_radar-data` giữ dữ liệu; `docker compose stop` hoặc `down` không xóa volume. Không chạy `down -v` nếu muốn giữ dữ liệu.

Ví dụ backup từ thư mục project:

```sh
docker compose exec -T db pg_dump -U radar -d finance_radar > finance-radar-backup.sql
```

Kiểm thử restore vào DB riêng trước khi cần khôi phục thật. Chưa có cron backup, retention tự động, alert ngoài UI, HA hoặc DR. Run history và articles tăng dần; cần định nghĩa retention theo nhu cầu và quyền sử dụng nguồn trước khi thêm cleanup job.

Flyway migration chạy khi startup. Không sửa migration đã áp dụng; thêm V2, V3... cho schema mới. Dùng migration backward-compatible khi triển khai nhiều version đồng thời.

## Kiểm thử và chất lượng

Backend unit + integration Testcontainers PostgreSQL; architecture rules kiểm tra hướng phụ thuộc. Luồng REST được kiểm tra với PostgreSQL thật trong Testcontainers; giao diện kiểm tra trực tiếp với backend thật. Tests không thay thế load test, pentest, rà soát license hoặc kiểm chứng toàn bộ nguồn.

Frontend lockfile được commit vào deliverable. Docker base image dùng major tags cho tính dễ cập nhật; production cần pin digest và có lịch refresh/scanning. Maven version pin qua Spring Boot BOM; dependency vulnerability scanning toàn bộ backend chưa được thiết lập.

## RAG và vector database

Database image được build từ `database/Dockerfile`, giữ PostgreSQL 17 Alpine và bổ sung pgvector 0.8.2. Migration V3 tạo `rag_documents`/`rag_chunks`; không xóa dữ liệu crawl. Khi restore lên máy khác, build image và cài extension trước. `pg_dump` bao gồm cả vector; không dùng image PostgreSQL thuần để restore database có extension vector.

Lưu OPENROUTER_API_KEY tại `~/.config/OpenRouter key/.env` (ngoài project); `.env` project chỉ giữ đường dẫn `OPENROUTER_ENV_FILE`. Docker Compose đọc qua `backend.env_file`. Khi đổi khóa, recreate backend bằng `docker compose up -d backend`. Lập chỉ mục chạy tự động khi có khóa. Theo dõi GET `/api/chat/status`: pending bao gồm failed; failed sẽ retry sau 5 phút. Model embedding được cố định để tránh trộn không gian vector. Xem [thiết kế RAG và giới hạn chi phí](ai-chat.md).

Nếu chạy Java bằng IDE/Maven ngoài Docker, cần nạp cả file env project và file khóa ngoài vào environment của tiến trình. Không dùng python-dotenv trong dự án Java. Không chia sẻ kết quả `docker compose config` đầy đủ vì có thể chứa giá trị đã resolve; dùng `docker compose config --quiet` để kiểm tra cấu hình.
