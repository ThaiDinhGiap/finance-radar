# AI đọc tin — RAG với pgvector

## Pipeline thực tế

Ingestion: RSS/HTML/API → parser hiện có → `articles` (plain-text title/summary) → `ArticleChunker` → OpenRouter Embeddings → `rag_chunks.embedding` trong PostgreSQL/pgvector.

Chat: câu hỏi → cùng embedding model → cosine semantic retrieval, tối đa 8 chunks → OpenRouter Chat Completions với câu hỏi + chunks → kiểm tra trích dẫn → trả lời kèm bài nguồn.

Không dùng keyword search làm fallback cho chat. Trang **Dòng thông tin** vẫn giữ bộ tìm kiếm từ khóa độc lập. Chưa có upload/parser PDF, DOCX, Excel, wiki hoặc database ngoài; nguồn đầu vào hiện tại là các báo đã crawl. Chưa crawl toàn văn: embedding và câu trả lời chỉ dựa trên tiêu đề/tóm tắt thật đã lưu.

## Kích hoạt

1. Lưu `OPENROUTER_API_KEY` trong file **`~/.config/OpenRouter key/.env`** ở ngoài project. Thư mục `OpenRouter key` có quyền 700, file `.env` có quyền 600. Trong `.env` của project chỉ đặt `OPENROUTER_ENV_FILE="/đường/dẫn/tuyệt/đối/OpenRouter key/.env"`. Docker Compose nạp file này qua `backend.env_file`; không có giá trị `environment` rỗng ghi đè khóa. Không đưa khóa vào mã nguồn hoặc trình duyệt.

   Trên máy hiện tại, khóa đã được chuyển sẵn. Với máy mới, tạo file ngoài project chứa `OPENROUTER_API_KEY=<khóa của bạn>` và chỉnh đường dẫn tương ứng. File vắng mặt vẫn cho phép chạy crawler; chat báo chưa cấu hình.
2. Sau khi đã build phiên bản này, chạy tại thư mục project:

   ```sh
   docker compose up -d backend
   ```

   Nếu cài mới hoặc cập nhật từ phiên bản cũ: `docker compose up -d --build` để build cả database có extension.
3. Mở **AI đọc tin**, chờ chỉ mục có bài sẵn sàng. Backend tự backfill bài cũ và tiếp nhận bài mới, không cần crawl lại.
4. Không cần nhập khóa quản trị trên giao diện. Dùng **Tìm theo ngữ nghĩa** để kiểm tra nguồn, hoặc **Hỏi AI** để tạo câu trả lời.

`configured=true` chỉ cho biết có cấu hình khóa, không xác nhận khóa/quota/quyền model hợp lệ. Khi không có khóa, không gọi provider, không sinh embedding giả và không bật nút hỏi. Khi khóa sai/hết quota, các bài lỗi được thử lại sau; kiểm tra OpenRouter project nếu số bài sẵn sàng không tăng.

Model trả lời: `inclusionai/ling-3.0-flash-vl:free`, cấu hình `RADAR_AI_MODEL`. Embedding: `openai/text-embedding-3-small` qua OpenRouter. Cùng dùng OPENROUTER_API_KEY; không dùng khóa OpenAI trực tiếp.

## Các quyết định triển khai

- Giữ modular monolith, Java records ở domain, use cases ở application, ports `EmbeddingModel`/`VectorRepository`/`AnswerModel`, adapters HTTP/JDBC ở infrastructure. Reuse React `request`, `useResource`, `Modal`, kiểu Article và CSS hiện có.
- Dùng PostgreSQL hiện có làm vector database, không thêm Qdrant hoặc một dịch vụ riêng. Docker image tự build pgvector 0.8.2 trên cùng nền PostgreSQL 17 Alpine để giữ tương thích volume hiện có. Không xóa volume.
- Embedding cố định `openai/text-embedding-3-small`, 1.536 chiều. Query và document dùng cùng model/dimensions. Nếu đổi embedding model, cần thay adapter/migration và reindex; không được trộn vector hai model.
- Chunk tối đa 1.200 ký tự, overlap 180, ưu tiên ranh giới khoảng trắng. Đây là giới hạn ký tự, không phải token. Tiêu đề đứng đầu văn bản; mỗi chunk lưu article ID, vị trí, nội dung và vector. Phiên bản chunker tham gia kiểm tra freshness.
- Tìm kiếm cosine **exact nearest-neighbor** trên pgvector, phù hợp corpus hiện tại; chưa dùng ANN/HNSW. Lọc nguồn, ngôn ngữ, thời gian, loại nguồn, model/version/fingerprint trước khi chọn tối đa 8 chunks. Không có bảo đảm hiệu năng ở hàng triệu đoạn; cần đo trước khi thêm ANN.
- Ngưỡng cosine mặc định `0.3`, chỉnh bằng `RADAR_RAG_MIN_SIMILARITY` (0–1). Đây là cấu hình khởi đầu, chưa được hiệu chỉnh bằng bộ đánh giá thực tế. Không có chunk vượt ngưỡng thì không gọi model sinh câu trả lời.
- Câu hỏi ngắn dưới 80 ký tự có thể kèm câu hỏi trước khi embed để hỗ trợ follow-up. Heuristic này có thể bị ảnh hưởng bởi chủ đề cũ; bắt đầu cuộc trò chuyện mới khi đổi chủ đề. Không gửi câu trả lời cũ làm nguồn sự thật.

## Lập chỉ mục và tính nhất quán

`KnowledgeIndexer` chạy trên executor riêng, scheduler đánh thức mỗi 15 giây; mỗi lượt tối đa 5 bài, một embedding batch cho các chunks của một bài. Không giữ transaction DB trong lúc gọi OpenRouter. Có khóa claim, lease UUID và hạn 5 phút; worker cũ không thể ghi đè kết quả sau khi worker mới claim. Lượt lỗi dừng lại, nghỉ 5 phút trước khi thử tiếp.

`rag_documents` lưu fingerprint nội dung, embedding model, chunker version, trạng thái và retry time. Trạng thái READY cùng việc thay toàn bộ chunks được commit trong một transaction. Nếu insert chunk lỗi, rollback toàn bộ. Nội dung thay đổi hoặc model/version khác thì không được retrieve từ vector cũ; worker sẽ lập chỉ mục lại. Đổi category sang SOCIAL/FORUM cũng loại bài khỏi retrieval ngay. Bài của nguồn tạm dừng vẫn có thể được dùng vì đó là dữ liệu đã thu thập; tạm dừng chỉ ngừng crawler.

Chỉ loại NEWS/INSTITUTION được index/retrieve. Đây là phân loại do người quản trị đặt, không phải hệ thống tự xác minh độ tin cậy của báo.

## Dẫn chứng, bảo mật và giới hạn

Model chỉ được cấp chunks đã truy xuất, metadata nguồn và thời gian; không có web-search tool. Instructions yêu cầu coi nội dung crawl là dữ liệu không đáng tin để thực thi lệnh, từ chối trả lời khi thiếu thông tin, và trích nguyên văn cho từng ý. Model Ling không hỗ trợ response_format; prompt yêu cầu JSON theo schema và backend từ chối output sai định dạng, thiếu trường hoặc bị cắt. Server kiểm tra article ID thuộc tập truy xuất và quote thực sự nằm trong chunk được cấp. URL luôn lấy từ database.

Kiểm tra quote/ID **không chứng minh** rằng nhận định được suy ra đúng từ đoạn trích. RAG và prompt không bảo đảm loại bỏ mọi hallucination/prompt injection. Người đọc vẫn cần đối chiếu nguồn, nhất là số liệu và thời điểm. Ngày thu thập không được coi là ngày xuất bản; bộ lọc dùng ngày xuất bản nếu có, ngược lại dùng ngày thu thập. Không có dữ liệu giá thời gian thực hoặc tư vấn đầu tư cá nhân.

Cả hai POST chat không yêu cầu khóa quản trị. Tối đa 2 request chat đồng thời và 12 request/phút/process; indexer có nhịp riêng. Đây không phải giới hạn chi phí toàn tài khoản hoặc limiter phân tán. Cần auth người dùng và quota riêng nếu mở chatbot công khai.

Provider API key chỉ ở backend. HTTP có hai endpoint cố định của OpenRouter, kiểm tra DNS public, chặn redirect, timeout/deadline, giới hạn response. Query embedding và generation có thể chạy nối tiếp; Nginx timeout 135 giây. Frontend hủy request khi unmount nhưng không bảo đảm hủy tác vụ provider đã bắt đầu.

Khi index, title/summary được gửi OpenRouter để tạo vector. Khi chat, câu hỏi, tối đa một câu hỏi trước cho query embedding; tối đa ba câu hỏi trước và tám chunks cho generation được gửi OpenRouter. Lịch sử chat chỉ ở bộ nhớ tab. Không gửi hoặc hiển thị reasoning của model. Chính sách lưu dữ liệu phụ thuộc OpenRouter và provider được định tuyến; không tuyên bố zero retention. Model chat được chọn là bản free, còn embedding có phí riêng; nên đặt ngân sách tại OpenRouter.

## API

- `GET /api/chat/status`: cấu hình, model chat, embeddingModel, knowledge, index `{ready,pending,failed,chunks}`. `pending` bao gồm bài lỗi/chưa sẵn sàng; `failed` là tập con.
- `POST /api/chat/retrieve`: embed query, tìm vector, trả các Article nguồn phân biệt (nội dung chunks dùng nội bộ). Có chi phí embedding; không gọi model sinh câu trả lời.
- `POST /api/chat/answer`: toàn bộ RAG, trả `status`, `message`, `statements[{text,evidence[{articleId,quote}]}]`, `sources`, `answeredAt`.

Cả hai POST nhận:

```json
{"question":"Các báo nói gì về lãi suất?","previousQuestions":[],"sourceId":null,"language":"","days":30}
```

Câu hỏi tối đa 1.500 ký tự, tối đa 3 câu hỏi trước; `language` là rỗng/vi/en/other, `days` 1–3650. Status câu trả lời: ANSWERED, NO_EVIDENCE, INSUFFICIENT_EVIDENCE. HTTP 503 nếu thiếu key/index chưa sẵn sàng, 429 khi limiter đầy, 502 nếu provider lỗi hoặc trích dẫn không hợp lệ, 400 input sai.

## Kiểm chứng và tài liệu chính thức

Kiểm thử PostgreSQL/pgvector thật với vector fixture để xác minh cosine ranking/filter/freshness, transaction rollback và lease recovery. Embedding/Chat Completions HTTP dùng mock để kiểm tra payload và parsing; kết quả gọi thật được ghi ở verification.md. Chưa có bộ đánh giá chất lượng toàn diện. Xem [kết quả kiểm chứng](verification.md).

Tham chiếu: [OpenRouter Embeddings](https://openrouter.ai/docs/api/api-reference/embeddings/submit-an-embedding-request), [Ling 3.0 Flash VL free](https://openrouter.ai/inclusionai/ling-3.0-flash-vl:free), [pgvector](https://github.com/pgvector/pgvector).
