# Nguồn dữ liệu và phạm vi hỗ trợ

Các URL seed là cấu hình xuất phát, không cam kết uptime/quyền tái xuất bản. Trạng thái thật xem Nhật ký thu thập. Không có bài giả để lấp khi nguồn lỗi.

- **VnExpress Kinh doanh**: `https://vnexpress.net/rss/kinh-doanh.rss`. [RSS chính thức và điều kiện sử dụng](https://vnexpress.net/rss).
- **Tuổi Trẻ Kinh doanh**: `https://tuoitre.vn/rss/kinh-doanh.rss`. Cần kiểm tra điều kiện RSS của nhà xuất bản cho mục đích triển khai cụ thể.
- **BBC Business**: `https://feeds.bbci.co.uk/news/business/rss.xml`. [Hướng dẫn feed BBC](https://www.bbc.co.uk/news/10628494).
- **Federal Reserve**: `https://www.federalreserve.gov/feeds/press_all.xml`. [Danh mục feed chính thức](https://www.federalreserve.gov/feeds/feeds.htm).
- **ECB Press releases**: `https://www.ecb.europa.eu/rss/press.html`. Nguồn thông cáo ngân hàng trung ương.
- **Reddit Economics RSS**: `https://www.reddit.com/r/Economics/.rss`. Mặc định tạm dừng, có thể bị chặn bởi robots/403. Không tích hợp Reddit OAuth trong bản này.
- **Mastodon economics hashtag**: `https://mastodon.social/api/v1/timelines/tag/economics?limit=20`. Mặc định tạm dừng; từng instance có chính sách robots và API riêng.

Báo chí và thông cáo có provenance nhưng hệ thống không tự xác minh mọi phát biểu. Nội dung diễn đàn/mạng xã hội là ý kiến người đăng, tách category để người đọc phân biệt.

## Thêm nguồn

RSS/Atom là ưu tiên vì cấu trúc ổn định, ít request. HTML dành cho trang danh sách có quyền truy cập, cấu hình selectors qua UI. Mastodon adapter nhận JSON array chứa `content`, `url`, `created_at`; không phải adapter JSON tổng quát cho mọi social platform.

Không crawl X, Facebook, LinkedIn, dữ liệu có đăng nhập/paywall hoặc tài khoản riêng tư. Muốn bổ sung cần API được cấp phép, credentials, hạn mức và adapter/test tương ứng. Không có token thì không đánh dấu các nền tảng này là đã tích hợp.

Không có discovery tự động toàn web, headless rendering, scraping bình luận, lịch sử quá khứ, sentiment, gợi ý đầu tư hoặc tự động tóm tắt mọi bài bằng LLM. Chức năng AI chat có RAG riêng theo câu hỏi, xem [AI chat](ai-chat.md). Không tự dịch bài viết.

## Kết quả thử trực tiếp ngày 20/09/2026

Năm nguồn báo/tổ chức ban đầu đều thành công. Mastodon trả 20 status công khai và đã được bật trong bản local. Reddit robots.txt cấm đường dẫn, nên nguồn được tạm dừng và giữ nhật ký lỗi. Thử thêm `https://economics.stackexchange.com/feeds` qua API nhưng robots.txt trả 403; nguồn thử này cũng đã tạm dừng. Không có dữ liệu diễn đàn thật được thu thập trong lần kiểm chứng này.

Bản local có 8 cấu hình nguồn, 6 đang bật. Seed cho cài mới vẫn là 7 nguồn, 5 đang bật; có thể bật Mastodon sau khi kiểm tra chính sách instance.
