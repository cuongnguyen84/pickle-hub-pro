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

Tài khoản X là **tiếng Anh**. Bài **không bao giờ chứa link, kể cả ở reply** —
xem [Luật link](#luật-link-đọc-trước-khi-viết-bất-kỳ-dòng-nào) bên dưới, đây là
luật tốn tiền thật chứ không phải luật văn phong.

Không có Edge Function `x-post-create` / `x-post-link-comment` — bản handoff
ban đầu thiết kế như vậy nhưng khi làm đã gộp vào worker `social-poster` để
không phải viết lần thứ hai các luật claim/retry vốn đã có ở đường Facebook.

## Luật link (đọc trước khi viết bất kỳ dòng nào)

Từ **20/04/2026** X tính tiền theo request, và một bài **có URL trong text**
đắt gấp **13,3 lần** một bài thường:

| Loại request | Giá |
|---|---:|
| Đăng bài thường | **$0,015** |
| Đăng bài có URL | **$0,200** |
| Summoned post (bot trả lời khi bị mention) | $0,010 |

Phụ phí này áp cho **cả reply do mình tự đăng**. Chỉ *summoned reply* mới được
giá $0,01, mà pipeline này không bao giờ sinh ra loại đó. Nghĩa là thiết kế
"tách link ra reply" **chưa bao giờ tiết kiệm tiền** — nó tốn $0,215/bài so với
$0,200 nếu nhét link thẳng vào body. Cái nó mua là phân phối, không phải chi phí.

**Quyết định của Cuong 16/08/2026: bỏ hẳn link đăng qua API.** Cần dẫn về web
thì **đánh vần domain**:

```
✅ Full breakdown at thepicklehub dot net     → $0,015
❌ Full breakdown at thepicklehub.net         → $0,200
❌ Full breakdown at https://thepicklehub.net → $0,200
```

Hai dòng đỏ ở trên **X đều tự biến thành link t.co** và tính tiền như nhau.
Domain trần không có `https://` trông vô hại nhưng giá y hệt — đây là cái bẫy
duy nhất của chính sách này, khác nhau đúng một ký tự.

Ép bằng máy ở hai tầng, không dựa vào trí nhớ:

- CHECK `x_posts_no_link_url` — cột `link_url` bắt buộc `NULL`, INSERT sai thì
  DB chặn ngay.
- `checkXBody()` trong `x.ts` — body chứa bất kỳ thứ gì X linkify được (kể cả
  `abc.net` trần) thì row bị `failed` **trước khi** gọi API, không tốn đồng nào.

Đổi ý sau này: `DROP CONSTRAINT x_posts_no_link_url` là đường reply link chạy
lại như cũ, code vẫn còn nguyên trong `x.ts`.

Đánh đổi phải biết: mất link click được thì `blog_teaser` gần như không kéo
được traffic về web nữa, chỉ còn giá trị nhận diện. Nếu sau này muốn traffic
thật, rẻ nhất là **Cuong tự reply link bằng tay từ điện thoại** — reply thủ
công không qua API thì $0.

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

Kích thích **reply**. Nêu một nhận định cụ thể, không hiển nhiên. Không còn
link click được, nên bản thân bài phải đứng vững như một nhận định — người đọc
không click cũng vẫn nhận được thứ gì đó.

```
[Player] was down 0-6 in the Super Sunday decider and won it 15-13.
We went back through every point of that comeback.

Full breakdown at thepicklehub dot net
```

Cấm kiểu "Check out our new article!" — đó là câu không mang thông tin nào.
Dòng domain đánh vần là **tuỳ chọn**: chỉ thêm khi bài thật sự có chỗ để đọc
tiếp, đừng dán vào mọi bài.

## Luật bắt buộc khi sinh `body`

- **Không URL, không domain trần, ở bất kỳ đâu.** Cần dẫn về web thì đánh vần:
  `thepicklehub dot net`. Viết `thepicklehub.net` là tự tăng giá bài đó 13 lần.
- **`link_url` luôn để trống.** DB đã chặn bằng CHECK `x_posts_no_link_url`.
- **Mỗi bài phải có ít nhất một chi tiết cụ thể** — tên, số, tỷ số. Cấm
  "Great match today!", "Check out our new article".
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

Worker kiểm tra trước khi gọi API (`checkXBody` trong `src/x.ts`) — row hỏng bị
đánh `failed` **trước khi** tốn request:

| `reason` | Nghĩa |
|---|---|
| `empty` | body rỗng |
| `too_long` | quá 280 ký tự có trọng số |
| `contains_url` | có URL hoặc domain trần → chặn để khỏi bị tính $0,200 |

`contains_url` bắt cả `abc.net` không có `https://`. Nó **không** nhầm tỷ số hay
rating: `def. Staksrud`, `3.5`, `11-9`, `U.S.` đều qua được (có test riêng cho
đúng bốn trường hợp này trong `x.test.ts`).

Xem trước một row mà không gọi X:

```sh
curl -X POST "$WORKER_URL/x/run" \
  -H "X-Auth-Secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"post_id":"<uuid>","dry_run":true}'
```

Trả về `weighted_length`, `valid` và `reason`.

## Insert mẫu

```sql
insert into x_posts (content_type, body, status)
values (
  'blog_teaser',
  E'Waters & Khlif were down 0-6 in the MLP Orlando Super Sunday decider and won it 15-13.\n\nWe went back through every point of that comeback.\n\nFull breakdown at thepicklehub dot net',
  'draft'
);
```

Không có cột `link_url` trong câu insert — cố tình. DB sẽ chặn nếu điền.

`source_id` là kiểu **`uuid`**, không phải text. Nên chỉ điền được khi nguồn là
một hàng trong DB (`news_items`, `matches`, `tournaments`…). **Bài blog là file
trong repo, chỉ có slug, không có uuid** — với `blog_teaser` thì để trống cả
`source_table` lẫn `source_id`, đừng nhét slug vào (`22P02 invalid input syntax
for type uuid`). Nguồn nào có uuid thì nên điền, đó là cách duy nhất truy ngược
một bài X về dữ liệu gốc khi cần kiểm chứng con số.

### Duyệt rồi mới xem trước được

Vòng drain **bỏ qua row `draft` kể cả khi `dry_run: true`** — nó chỉ nhìn row
`approved`. Muốn xem trước một bài thì phải đổi sang `approved` trước, rồi mới
gọi dry-run. An toàn: `approved` **không** tự lên bài, chỉ lần gọi `/x/run`
không có `dry_run` mới đăng thật.

```
draft → (approved) → dry-run xem trước → /x/run thật → posted
```

**Số liệu phải có thật.** Mọi tỷ số, tên, kỷ lục trong bài phải truy được về
`source_id`. Ví dụ minh hoạ trong doc thì đặt tên giả cũng được, nhưng row thật
mà bịa tỷ số thì tài khoản brand đang phát tin sai — và tweet không rút lại
được.

## Liên quan

- `workers/social-poster/README.md` §X — vận hành, retry, xử lý row kẹt.
- `workers/social-poster/src/x.ts` — state machine, kiểm tra độ dài, reply link.
- `docs/cron-schedules.md` — job `x-poster-drain-5min`.
