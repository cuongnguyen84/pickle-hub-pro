# X content playbook — luật soạn bài cho `x_posts`

> **Đối tượng đọc:** AI (Cowork / Claude session) khi viết lại tin để đăng lên
> tài khoản X `@thepicklehub`. Đây là nguồn sự thật cho nội dung X — đọc file
> này TRƯỚC khi insert bất kỳ dòng nào vào `x_posts`.
>
> **Không áp dụng cho Facebook.** Pipeline FB (`news_items` → Gemini caption →
> Graph API) đang chạy tốt, có prompt riêng trong Edge Function
> `news-social-caption` và skill `pickleball-social-content` (tiếng Việt).
> Đừng đem luật ở đây sang sửa bên đó.

## Bối cảnh kỹ thuật

Tài khoản X là **tiếng Anh**. Bài không chứa link; link nằm ở cột `link_url`
và worker `social-poster` tự reply nó vào chính bài đó khoảng 90 giây sau khi
đăng (`POST /x/run`, xem `workers/social-poster/src/x.ts`).

Không có Edge Function `x-post-create` / `x-post-link-comment` — bản handoff
ban đầu thiết kế như vậy nhưng khi làm đã gộp vào worker `social-poster` để
không phải viết lần thứ hai các luật claim/retry vốn đã có ở đường Facebook.

## Nguyên tắc cốt lõi

Thuật toán "For you" của X chấm điểm hành động tương tác rất lệch:

| Hành động | Trọng số |
|---|---:|
| Copy-link share | ×20 |
| Reply | ×5–20 |
| Quote | ×5 |
| Share qua DM | ×5 |
| Like | ×1 |

Suy ra: **mỗi bài phải nhắm cụ thể vào một trong các hành động điểm cao**, không
viết chung chung kiểu quảng cáo. Một bài hay mà chỉ moi được like thì gần như
vô hình.

## 4 dạng bài

Mỗi row phải gắn đúng một giá trị vào cột `content_type`.

### 1. `result` — kết quả nóng

Kích thích **reply + copy-link share**. Đăng trong vài giờ sau khi trận/giải
kết thúc. Ngắn, có một chi tiết sắc: tỷ số, kỷ lục, chuỗi thắng.

```
🚨 RESULT: [Player A] def. [Player B] 11-6, 11-9 to win the [Tournament]
final in [City]. [Player A]'s 3rd PPA Tour Asia title this year.
```

### 2. `prediction` — dự đoán / tranh luận

Kích thích **reply thuần túy**. Câu hỏi mở trước trận lớn. Không link, không
kêu gọi hành động — hỏi thật.

```
[Player A] vs [Player B] tomorrow — [A] has won the last 3 head-to-heads
but [B] has looked sharper all week. Who takes it?
```

### 3. `stat` — insight số liệu

Kích thích **quote + share**. Một con số cụ thể lấy từ dữ liệu live scoring /
PPA Tour thật của ThePickleHub. Đây là lợi thế cạnh tranh duy nhất không ai
copy được — dùng số thật, không suy đoán, không ước lượng.

```
[Player A] has now won 14 straight points on serve across the last two
matches — best streak of the tournament so far.
```

### 4. `blog_teaser` — teaser bài blog

Kích thích **click + reply**. Nêu một nhận định cụ thể, không hiển nhiên.

```
We watched every set of [Player]'s comeback run this week. Here's what
actually changed in his game after Game 2 — not just the scoreline.
```

Cấm kiểu "Check out our new article!" — đó là câu không mang thông tin nào.

## Luật bắt buộc khi sinh `body`

- **Không chèn link trong `body`.** Link luôn để riêng ở `link_url`; worker tự
  reply sau. URL trong body làm giảm phân phối.
- **Mỗi bài phải có ít nhất một chi tiết cụ thể** — tên, số, tỷ số. Cấm
  "Great match today!", "Check out our new article".
- **`prediction` không được có `link_url`.** Mục tiêu thuần là reply; thêm link
  làm loãng.
- **Ngắn.** Chừa dòng trống trước dòng "Full recap 👇" hoặc câu hỏi cuối để dễ
  đọc trên mobile.
- **Tối đa 1 hashtag**, và chỉ khi thật sự cần. X không thưởng hashtag trong
  bảng trọng số.
- **`status='draft'` khi mới sinh.** AI không được tự set `approved`. Cuong
  review rồi mới đổi sang `approved`; worker chỉ lấy row `approved` để đăng.

## Giới hạn tần suất

**2–4 bài/ngày**, tính gộp cả 4 dạng. Hệ số Đa dạng tác giả của X giảm dần
theo số bài/ngày từ cùng một tác giả — đăng nhiều hơn thì các bài tự triệt
tiêu lẫn nhau.

Worker giãn nhịp bằng `X_POST_MIN_GAP_MINUTES` (mặc định 90 phút) nên hàng đợi
không bao giờ bung một lúc, nhưng **giới hạn số bài/ngày là trách nhiệm của
người soạn**: hàng đợi 12 row `approved` vẫn sẽ được đăng hết trong ngày.

## Giới hạn kỹ thuật của `body`

X đếm theo **ký tự có trọng số**, không phải `body.length`:

- URL luôn tính 23 ký tự bất kể dài bao nhiêu (t.co).
- Emoji và ký tự ngoài BMP tính 2.
- Trần là 280.

Worker kiểm tra trước khi gọi API (`checkXBody` trong `src/x.ts`): body rỗng
hoặc quá 280 → row bị đánh `failed` ngay, không tốn quota. Body có URL → vẫn
đăng nhưng bị gắn cảnh báo `body_contains_link` (không tự sửa bài đã duyệt).

Xem trước một row mà không gọi X:

```sh
curl -X POST "$WORKER_URL/x/run" \
  -H "X-Auth-Secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"post_id":"<uuid>","dry_run":true}'
```

Trả về `weighted_length`, `valid`, `warning`, và đúng chuỗi reply link sẽ gửi.

## Insert mẫu

```sql
insert into x_posts (content_type, body, link_url, source_table, source_id, status)
values (
  'result',
  E'🚨 RESULT: Ben Johns def. Federico Staksrud 11-6, 11-9 to win the Hong Kong Open final.\n\nHis 3rd PPA Tour Asia title this year.',
  'https://www.thepicklehub.net/en/news/hong-kong-open-final',
  'news_items',
  '<uuid>',
  'draft'
);
```

`source_table` / `source_id` không bắt buộc nhưng nên điền — đó là cách duy
nhất truy ngược một bài X về dữ liệu gốc khi cần kiểm chứng con số.

## Liên quan

- `workers/social-poster/README.md` §X — vận hành, retry, xử lý row kẹt.
- `workers/social-poster/src/x.ts` — state machine, kiểm tra độ dài, reply link.
- `docs/cron-schedules.md` — job `x-poster-drain-5min`.
