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

**Quyết định của Cuong 16/08/2026: bỏ hẳn link đăng qua API.**

```
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

**Cũng đừng đánh vần domain.** Bản đầu của doc này gợi ý viết
`thepicklehub dot net` để né phí. Bỏ rồi: nó không bấm được, nó là câu quảng
cáo, và `OpenLinkWeight = 0.2` cho thấy kể cả link bấm được cũng gần như không
đóng góp gì cho phân phối (xem mục dưới). Muốn traffic thật thì **Cuong tự reply
link bằng tay từ điện thoại** — reply thủ công không qua API nên $0, và chỉ làm
với bài thật sự đáng.

## Nguyên tắc cốt lõi — theo mã nguồn X công bố 14/08/2026

X mở mã "For you" tại [xai-org/x-algorithm](https://github.com/xai-org/x-algorithm)
(Apache-2.0). Trọng số dưới đây lấy trực tiếp từ `home-mixer/params/param.rs`,
không phải từ bài blog tóm tắt. Cột bên phải quy về đơn vị "bằng mấy cái like",
vì `FavoriteWeight = 0.5` chứ không phải 1 — bản playbook đầu tiên ghi like = ×1
nên **mọi tỷ lệ trong đó bị hụt đúng một nửa**.

| Hành động | Hằng số | Trọng số | ≈ bao nhiêu like |
|---|---|---:|---:|
| Copy-link share | `ShareViaCopyLinkWeight` | 20.0 | **40×** |
| Reply từ người follow qua lại | `ReplyWeight` + `BidirectionalFollowReplyWeightBoost` | 5.0 + 15.0 | **40×** |
| Reply thường | `ReplyWeight` | 5.0 | 10× |
| Quote | `QuoteWeight` | 5.0 | 10× |
| Share qua DM | `ShareViaDmWeight` | 5.0 | 10× |
| **Follow tác giả** | `FollowAuthorWeight` | 4.0 | **8×** |
| Share thường | `ShareWeight` | 2.0 | 4× |
| Repost | `RetweetWeight` | 1.0 | 2× |
| Like | `FavoriteWeight` | 0.5 | 1× |
| Click | `ClickWeight` | 0.4 | 0,8× |
| **Mở link** | `OpenLinkWeight` | 0.2 | **0,4×** |
| Mở ảnh / video | `PhotoExpandWeight`, `VideoOpenWeight` | 0.05 | 0,1× |
| Dwell, profile click | `DwellWeight`, `ProfileClickWeight` | **0.0** | 0 |
| Bookmark | *không có trong bảng* | — | bị bỏ qua |

### Điểm âm mới là thứ quyết định

| Hành động | Hằng số | Trọng số | ≈ bao nhiêu like |
|---|---|---:|---:|
| Report | `ReportWeight` | −234.0 | **−468×** |
| Mute tác giả | `MuteAuthorWeight` | −58.8 | **−118×** |
| Not interested | `NotInterestedWeight` | −43.2 | **−86×** |
| Block tác giả | `BlockAuthorWeight` | −31.2 | −62× |

**Đây là lý do cấm bài quảng cáo, và là lý do bằng số chứ không phải khẩu vị.**
Bài đọc ra mùi quảng cáo không chỉ ít like — nó mời người ta bấm "Not
interested". Một cú bấm đó xoá sạch **86 like**; bài phải kiếm 87 like mới hoà
vốn cho đúng một người. Một cú Mute là 118 like. Với tài khoản nhỏ, một bài
quảng cáo dở có thể âm điểm ròng.

### Bốn hệ quả bắt buộc khi viết

1. **Chỉ nhắm copy-link share và reply.** Hai thứ đó 40×, mọi thứ khác là nhiễu.
   Bài chỉ moi được like thì gần như vô hình.
2. **Đừng viết cho lượt bấm.** Click 0.4, mở link 0.2, ảnh/video 0.05, dwell và
   profile click **bằng 0**, bookmark không được tính. Bài "đọc thêm ở link",
   "xem ảnh bên dưới", "lưu lại để dành" đều nhắm vào thứ gần như không có điểm.
3. **Làm người ta muốn follow.** `FollowAuthorWeight = 4.0`, bằng 8 like — cao
   bất ngờ. Bài chứng minh mình có dữ liệu mà chỗ khác không có (số liệu live
   scoring, thống kê PPA) ăn thẳng vào tín hiệu này.
4. **Bài phải tự đứng được.** Không link, không "xem tiếp", không CTA. Người đọc
   lướt qua mà không bấm gì vẫn phải nhận được trọn vẹn một thông tin.

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

Kích thích **copy-link share (40×) + quote (10×)**, và đây cũng là dạng ăn
`FollowAuthorWeight` (8×) mạnh nhất: người ta follow vì thấy mình có số liệu
chỗ khác không có. Một con số cụ thể lấy từ dữ liệu live scoring / PPA Tour
thật của ThePickleHub — số thật, không suy đoán, không ước lượng.

```
[Player A] has now won 14 straight points on serve across the last two
matches — best streak of the tournament so far.
```

### 4. `blog_teaser` — nhận định rút từ bài dài

**Không còn là teaser.** Teaser là bài quảng cáo: nó giữ lại thông tin để bắt
người ta bấm, mà click chỉ đáng 0.4 còn mở link 0.2 — giữ lại thông tin là trả
giá bằng reply và copy-link (40×) để đổi lấy thứ gần như không có điểm.

Cách viết đúng: **lấy kết luận sắc nhất trong bài dài ra đăng thẳng**. Bài dài
vẫn còn đó cho ai muốn tìm; bài X phải trọn vẹn kể cả khi không ai bấm gì.

```
Waters & Khlif were down 0-6 in the Super Sunday decider and won it 15-13.

The turn came when they stopped resetting to the middle and started
attacking Patriquin's backhand at the kitchen line.
```

Cấm tuyệt đối, đây đều là bài quảng cáo:

```
❌ Check out our new article!
❌ We broke down every point — read the full analysis
❌ Full breakdown at thepicklehub dot net
❌ Link in bio / thread below 👇
```

Ba dòng đầu không mang thông tin nào. Dòng cuối cùng nhắm vào click. Cả bốn đều
là loại làm người đọc bấm "Not interested" — mỗi cú bấm đó là −86 like.

## Luật bắt buộc khi sinh `body`

- **Không URL, không domain trần, không domain đánh vần.** Không có ngoại lệ.
  `checkXBody()` chặn hai loại đầu; loại thứ ba máy không bắt được nên đây là
  luật người phải giữ.
- **`link_url` luôn để trống.** DB đã chặn bằng CHECK `x_posts_no_link_url`.
- **Không CTA.** Không "read more", "check out", "link in bio", "thread below",
  "follow us for more". Bài kết thúc bằng thông tin hoặc bằng câu hỏi thật, hết.
- **Mỗi bài phải có ít nhất một chi tiết cụ thể** — tên, số, tỷ số. Cấm
  "Great match today!", "Exciting stuff!".
- **Không mồi tương tác.** "Like if you agree", "RT to spread the word",
  "comment your pick 👇" — X có nhận diện engagement bait, và nó moi đúng loại
  like 0.5 trong khi rủi ro Not interested là −43.2.
- **Ngắn.** Chừa dòng trống trước câu cuối để dễ đọc trên mobile.
- **Tối đa 1 hashtag**, và chỉ khi thật sự cần. Hashtag không có trong bảng
  trọng số, tức không được thưởng gì.
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
  E'Waters & Khlif were down 0-6 in the MLP Orlando Super Sunday decider and won it 15-13.\n\nThe turn came when they stopped resetting to the middle and started attacking Patriquin''s backhand at the kitchen line.',
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
