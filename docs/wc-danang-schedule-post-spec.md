# Spec: bài lịch thi đấu Pickleball World Cup 2026 Đà Nẵng

> Viết 2026-08-24 cho mốc **WC-SCHEDULE-POST (2026-08-25)**. Cuong chốt: **tách bài lịch riêng + rút gọn phần lịch trong bài how-to-watch**, ship sáng 25/8.
>
> **Mục đích của file này:** mọi dữ kiện dưới đây ĐÃ verify ngày 24/8. Phiên 25/8 **không cần research lại** — chỉ viết. Nếu phải sửa số nào, ghi lý do vào đây.

---

## 1. Vì sao tách bài (và rủi ro phải xử lý)

Bài `pickleball-world-cup-2026-da-nang-how-to-watch` (sửa 24/8, commits `f047e88` + `d800073`) hiện **đã chứa đầy đủ** lịch Cá nhân 8 ngày + lịch Đồng đội 3–6/9. Tách bài lịch riêng mà **không rút gọn bài cũ** thì hai URL sẽ cạnh tranh trên đúng query `lịch thi đấu world cup pickleball` — đúng hình dạng cannibalization mà mốc `TOURN-CAL-READ` (28/8) đang canh trên cụm `/tournaments`.

**Bắt buộc làm cả hai vế trong CÙNG một push:**

- **Bài mới** = trang lịch đầy đủ. Intent: *"lịch thi đấu"*, *"đấu ngày nào"*, *"mấy giờ"*.
- **Bài how-to-watch** = rút phần lịch xuống còn **tóm tắt 4–5 dòng mốc chính** (30/8 khởi tranh Cá nhân · 2/9 khai mạc · 3/9 Đồng đội · 6/9 chung kết) + link sang bài mới. Giữ nguyên các mục KHÔNG trùng: vé, sân, FPT Play, khách sạn, "chưa biết", "ngoài các trận đấu".
- Internal link **2 chiều**, đúng cặp ngôn ngữ (EN→EN, VI→VI). Không để `/vi/` trỏ vào slug EN.

---

## 2. Slug đề xuất

| | Slug |
|---|---|
| EN | `pickleball-world-cup-2026-da-nang-schedule` |
| VI | `lich-thi-dau-pickleball-world-cup-2026-da-nang` |

VI slug đặt đúng cụm từ khoá người Việt gõ. Kiểm slug VI chưa tồn tại trước khi INSERT.

---

## 3. Dữ kiện đã verify (KHÔNG research lại)

### Nguồn

- **Nền tảng chính thức: `sporttora.com/pwc2026`** — event record `updatedAt` **2026-08-23T13:10Z**, status `REGISTRATION_CLOSED`. Đây là nguồn sống.
- ⚠️ `pickleballworldcupdanang.com` = **"Site under maintenance"** (24/8). Đừng dẫn.
- Ảnh lịch chính thức do Cuong gửi 24/8 (lịch Đồng đội) — **nguồn duy nhất** cho lịch Đồng đội ngày-theo-ngày; trang chính thức KHÔNG đăng phần này.

### Khung chung

- Giải: **Heineken Pickleball World Cup 2026**, Đà Nẵng, **30/8 – 6/9/2026**.
- **Hai giải song song**: Giải Cá nhân (mở đăng ký, chia theo DUPR 3.0–5.0 + Pro + Junior + xe lăn) và Giải Đồng đội Quốc gia (5 hạng mục).
- **Lễ khai mạc: thứ Tư 2/9, 18:00–20:00** (JSON chính thức). VietnamPlus xác nhận 2/9, nói "chiều" — dùng giờ chính thức, ghi chú nếu cần. 2/9 = Quốc khánh.
- Ngày thi đấu chạy **08:00–18:00**.
- ⚠️ BTC ghi rõ: **giờ trên lịch là khung của CẢ nội dung** (trận đầu → trận cuối), **không phải giờ trận của từng người**. Phải nói câu này trong bài.
- BTC ghi lịch **"có thể thay đổi"**.

### Lịch Giải Cá nhân (8 ngày)

| Ngày | Nội dung | Sân |
|---|---|---|
| CN 30/8 | Đơn nam + đôi nữ, 3.0–5.0 | toàn bộ |
| T2 31/8 | Đôi nam 3.0–5.0; **Pro đơn nam + Pro đơn nữ** | Tuyên Sơn A&D, Tiên Sơn |
| T3 1/9 | Đôi nam nữ 3.0–5.0; **Pro đôi nam + Pro đôi nữ** | — |
| T4 2/9 | Đơn nữ 3.0–5.0; **Pro đôi nam nữ**; đơn xe lăn. **Khai mạc 18:00–20:00** | — |
| T5 3/9 | Đôi nam nữ Junior; Doanh nhân; Người nổi tiếng | Trường Sơn, Hợp Thành Phát |
| T6 4/9 | Doanh nhân; Người nổi tiếng; đôi xe lăn | — |
| T7 5/9 | Đơn nam + đơn nữ Junior; xe lăn hỗn hợp | Tuyên Sơn, Trang Hoàng, Trường Sơn, Hợp Thành Phát, Fitfun |
| CN 6/9 | Đôi nam + đôi nữ Junior; **CHUNG KẾT toàn bộ nhóm Pro 08:00–18:00** | **Tiên Sơn sân 1** |

### Lịch Giải Đồng đội Quốc gia (4 ngày)

| Ngày | Nội dung |
|---|---|
| T5 3/9 | Vòng bảng **Open** bảng A–L từ **08:00**, bảng M–P từ **14:00**; vòng bảng **Seniors** |
| T6 4/9 | Vòng bảng Kids, Masters, Seniors, Juniors từ 08:00; **Seniors + Masters R32 & R16**, **Open R32**, **Juniors R16** |
| T7 5/9 | **Tứ kết** Seniors/Kids/Open/Masters từ 08:00; **bán kết** Seniors/Kids/Open; **Kids HCĐ + chung kết 12:00**; chung kết + HCĐ Masters, Juniors buổi chiều |
| CN 6/9 | **Chung kết Seniors**, **chung kết Juniors** |

### Thể thức trận đồng đội

6 ván, thứ tự cố định: **đôi nam → đôi nữ → đôi nam nữ #1 → đôi nam nữ #2 → đơn nữ → đơn nam**. Tới **21 điểm, rally scoring, cách biệt 2**, bestOf 1.

### Số đội — GIỮ CẢ HAI, nói rõ vì sao vênh

- **156 đội ĐĂNG KÝ** (64 Open / 40 Senior / 20 Master / 16 Junior / 16 Kids) — báo chí + liên đoàn, 15–18/8.
- **152 đội trong bracket ĐÃ BỐC THĂM** (64 / 40 / 20 / **14** / **14**) — JSON chính thức, bốc 22/8. Junior và Kids mỗi bên rụng 2.
- ❌ **KHÔNG tự chọn một số.** Ghi cả hai + lý do.
- Nhóm tuổi: Senior **50+**, Master **60+**, Junior **U18**, Kids **U14**.
- Trang chủ sporttora: **66 đoàn/quốc gia**, **222 trận** đồng đội, **97 sân / 7 địa điểm**, tổng thưởng **500.000 USD**.
- Con số VĐV: dùng **"hơn 5.000 VĐV từ 81 quốc gia"** (Nhân Dân + VietnamPlus/TTXVN 15–16/8) và ghi là con số **đăng ký/dự kiến**, không phải số chốt. Nguồn cũ 24/4 ghi "hơn 4.000 / 80 quốc gia" — đừng trộn.

### Việt Nam

- Bảng **A** ở **Open, Masters, Juniors, Kids**. **KHÔNG có đội Seniors.** Là **hạt giống số 1** bảng A.
- Bảng A Open: **Việt Nam, Colombia, Quần đảo Cayman, Chile**. Trận mở màn: **Việt Nam vs Colombia**.
- Bảng A Masters: Việt Nam, Brazil, Hồng Kông (TQ), Cayman.
- Bảng A Juniors: Việt Nam, Costa Rica, Hàn Quốc, Malaysia.
- Bảng A Kids: Việt Nam, Singapore, Úc (bảng 3 đội).
- **Đội hình Open (10, nguồn Dân trí 17/8):** Đỗ Minh Quân (đội trưởng), Lý Hoàng Nam, Quang Dương, Phúc Huỳnh, Trương Vinh Hiển, Trịnh Linh Giang, **Ken Tâm**, **Sophia Huỳnh Trần**, Trang Huỳnh, Sĩ Bội Ngọc.
- Junior/Kids đáng chú ý: Tống Nhật Minh, Phạm Hoài Anh, Bảo Dương, Khang Trần, Sophia Phương Anh.
- Tổng đoàn VN: **29 VĐV** (Nhân Dân).

### 🔴 Chung kết OPEN — chỗ KHÔNG được khẳng định

Lịch công bố: 5/9 có **tứ kết + bán kết Open**; 6/9 **chỉ** ghi chung kết Seniors + Juniors. **Trận chung kết Open không nằm ở ngày nào.** Bracket chính thức CÓ `roundNum 8 = Final` + `roundNum 9 = Third Place` cho Open (`open_team_coed____default__m126` / `m127`) nhưng **chưa gán ngày/giờ/sân** — toàn bộ 1.398 trận đều chưa có `scheduledAt`.

Ba dấu hiệu trỏ về 6/9: (1) gói vé duy nhất nhãn **FINALS** đề **6/9**; (2) gói 5 ngày mô tả *"Opening → Rounds → Quarterfinals → Semifinals → Finals & Music Festival"*; (3) Chung kết nhóm Pro của Giải Cá nhân ở **Tiên Sơn sân 1 ngày 6/9**.

➡️ **Viết là "dự kiến 6/9", KHÔNG khẳng định**, và dặn người đọc đừng đặt vé máy bay về dựa trên nó. Bài how-to-watch đã có nguyên một mục về chuyện này — bài lịch nên nhắc lại ngắn + link sang.

### Sân — có mâu thuẫn, phải cảnh báo

Trang `/location` của BTC và lịch của chính họ **không khớp**:

- Lịch dùng: Tiên Sơn, Tuyên Sơn (A&D + B), **Trường Sơn**, **Fitfun**, **Papi**, Trang Hoàng, Hợp Thành Phát.
- `/location` liệt kê: Tiên Sơn (8 sân, đường Phan Đăng Lưu), Tuyên Sơn (31 sân, đường Nại Nam 2), Trang Hoàng (16), **KingKong** (8), Hợp Thành Phát (8), **Furama** (7), **AK** (9).
- Lịch là tài liệu **mới hơn**. Bảo người đọc xem tên sân ghi trên trận của chính họ.
- Địa chỉ đầy đủ duy nhất có: **Tuyen Son Sports Complex — Nai Nam St., Hoa Cuong Ward, Da Nang** (GENERAL_DESCRIPTION.pdf). Số nhà Tiên Sơn: **KHÔNG TÌM ĐƯỢC**, chỉ có tên đường.

### Xem ở đâu

**FPT Play** — vừa **đồng tổ chức** vừa **phát sóng độc quyền tại Việt Nam** (VOV 24/4): SmartTV, mobile, FPT Play Box, fptplay.vn. ❌ **Miễn phí hay cần thuê bao: KHÔNG TÌM ĐƯỢC** — đừng viết "xem miễn phí". Phát sóng quốc tế: chưa công bố.

### Vé

Chỉ **4 gói hospitality**, **KHÔNG có vé phổ thông** ở bất kỳ mức giá nào:

| Gói | Ngày | USD |
|---|---|---|
| Finals & Music Festival — bàn 2 khách | 6/9 | 2.000 |
| VVIP Finals — 1 ghế | 6/9 | 1.000 |
| Full Package — trọn 5 ngày | 2–6/9 | 3.600 |
| VVIP Special — bàn 3 khách, 5 ngày | 2–6/9 | 5.400 |

❌ **Đừng viết "vào cửa tự do"** — không nguồn nào nói vậy.

---

## 4. Cấu trúc bài đề xuất

1. **Đoạn mở (GEO)** — dateline "cập nhật <ngày>", nêu ngay: 30/8–6/9, Cá nhân khởi tranh 30/8, Đồng đội 3/9, khai mạc 2/9 18:00–20:00, chung kết 6/9. Nhắc **"ThePickleHub"** đúng 1 lần, tự nhiên. Front-load tên + ngày + số.
2. **Hai giải, hai lịch — đừng nhầm** (mục ngắn, giải thích vì sao có 2 hệ thống)
3. **Lịch Giải Đồng đội Quốc gia 3–6/9** — bảng, đặt TRƯỚC vì độc giả VN quan tâm nhất
4. **Việt Nam đấu ngày nào** — bảng A ×4 nội dung, đội hình Open, trận mở màn vs Colombia
5. **Lịch Giải Cá nhân 30/8–6/9** — bảng 8 ngày
6. **Chung kết Open đấu lúc nào** — ngắn, dẫn "dự kiến 6/9", link sang how-to-watch
7. **Sân nào ở đâu** — kèm cảnh báo lệch danh sách
8. **Xem thế nào** — FPT Play, ghi rõ chưa biết free/thuê bao
9. **Những gì chưa có trong lịch** — giờ từng trận, phân sân, CK Open
10. **FAQ** 6 câu

---

## 5. Checklist bắt buộc (CLAUDE.md, 4 thay đổi + GEO)

1. `src/content/blog/posts/<slug-en>.ts` — full BlogPost, content.en **và** content.vi
2. `src/content/blog/metadata.ts` — prepend entry. **Nguồn SEO duy nhất.** Không hand-edit `render/blog-meta.ts` hay `static-blog-slugs.ts`.
3. Supabase `vi_blog_posts` INSERT — `alternate_en_slug` trỏ về slug EN
4. `node scripts/gen-blog-barrel.mjs` — barrel là loader DUY NHẤT của SSR bot path
5. **GEO**: "ThePickleHub" 1 lần trong đoạn mở (EN + VI), front-load đáp án, entity + năm đi cùng nhau, dateline "cập nhật"

**Giới hạn byte** (test `seo-byte-budget` sẽ chặn): `metaTitle*` ≤ **60 byte**, `metaDescription*` ≤ **160 byte**. Tiếng Việt có dấu ăn nhiều byte — đếm trước khi commit.

**Verify trước push:** `npx tsc --noEmit` · `npm run test` · `npx eslint` · barrel đúng số post.

**Sau deploy:** `curl -A Googlebot "<URL>?nocache=1"` cả 4 URL (2 bài × 2 ngôn ngữ), assert **word count thật** chứ không chỉ tag → IndexNow ×4 → append `.gsc-index-queue.json` status `pending`.

---

## 6. ⚠️ Hai bẫy đã dính trong ngày 24/8 — đừng dính lại

1. **`/vi/blog/` lấy CẢ `content_html` LẪN `faq_items` từ Supabase**, không phải từ post file. Sửa post file → tests xanh → push → bản VI **vẫn sai**. Phải UPDATE riêng cả hai cột. Đã dính 2 lần trong ngày.
2. **`[]` trả về từ Supabase Management API KHÔNG có nghĩa là đã đổi.** Luôn `SELECT` lại sau UPDATE/INSERT để verify.

Thêm: `git push` có thể bị reject vì remote chạy trước — **rebase, KHÔNG force push**.
