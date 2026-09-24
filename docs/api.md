# REST API v1 (đường dẫn `/api`)

API chưa version prefix vì chỉ có một client cùng release; version breaking-change cần thêm `/api/v2` hoặc thực hiện migration đồng bộ. JSON camelCase, UUID, thời gian ISO-8601 UTC; UI định dạng theo timezone trình duyệt. Response lỗi theo Problem Details với `status`, `title`, `detail`.

## Đọc

- `GET /api/sources`: danh sách nguồn và tình trạng hiện tại.
- `GET /api/articles?q=&sourceId=&language=&category=&page=0&size=20`: `{items,total,page,size}`. Không truyền `sourceId` khi không lọc; `language` là rỗng/vi/en/other; category rỗng/NEWS/INSTITUTION/FORUM/SOCIAL. `q` tối đa 200 ký tự; size 1–100, page 0–100000.
- `GET /api/runs?page=0&size=20`: lịch sử, mới nhất trước; fetched/inserted/rejected, phần còn lại là bài trùng.
- `GET /api/stats`: articles, sources, enabledSources, runningSources (gồm QUEUED/RUNNING), failingSources (failures>0, kể cả nguồn đã tạm dừng).
- `GET /actuator/health`: kiểm tra sức khỏe cơ bản.

## Quản trị

Request có body JSON dùng `Content-Type: application/json`. API không yêu cầu khóa quản trị; không có cookie/session hoặc đăng nhập JWT.

`POST /api/sources` -> 201; `PUT /api/sources/{id}` -> 200, dùng cùng body:

```json
{
  "name": "BBC · Business",
  "url": "https://feeds.bbci.co.uk/news/business/rss.xml",
  "kind": "RSS",
  "category": "NEWS",
  "language": "en",
  "region": "GLOBAL",
  "intervalMinutes": 30,
  "itemSelector": null,
  "titleSelector": null,
  "linkSelector": null,
  "summarySelector": null
}
```

Region: VN/US/EU/GLOBAL. Interval: 15–10080 phút. URL tối đa 2048 ký tự, HTTPS port443 không userinfo, name tối đa 120. Source mới luôn `enabled=false`. PUT giữ enabled, ID, lịch sử và articles; không cho sửa khi có active_run_id. URL phải duy nhất.

HTML dùng `kind=HTML`, cấu hình `itemSelector="article"`, `titleSelector="h2"`, `linkSelector="a"`, tùy chọn `summarySelector=".description"`. Selectors con relative với từng item. Chỉ hỗ trợ HTML có sẵn từ server.

`PATCH /api/sources/{id}` body `{"enabled":true}` -> 204.

`POST /api/sources/{id}/crawl` -> 202 `{"runId":"uuid"}`. Async, xem `/runs`. Trả 409 nếu tạm dừng, đã có job, hoặc chưa hết 60 giây từ lần enqueue trước. Job đã bắt đầu có thể hoàn thành dù nguồn vừa bị tạm dừng; thao tác pause chặn các lượt tiếp theo, không ngắt HTTP đang chạy.

Không có DELETE để tránh mất provenance/lịch sử; dùng tạm dừng.

## Mã lỗi

- 400: input sai, URL scheme/port không hợp lệ, selector sai, enum/pagination ngoài giới hạn.
- 401: khóa quản trị thiếu/sai.
- 404: không có source.
- 409: duplicate URL, conflict job hoặc đang chạy khi sửa.
- 500: lỗi xử lý nội bộ; không trả stack trace cho client.

Lỗi upstream trong crawl là FAILED job, không phải lỗi HTTP của enqueue đã thành công.

## RAG chat

Xem [hợp đồng API và cấu hình AI](ai-chat.md#api). GET trạng thái công khai; cả POST retrieve và answer không yêu cầu khóa quản trị.
