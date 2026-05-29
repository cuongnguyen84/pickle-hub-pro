import type { BlogPost } from "@/content/blog/types";

const post: BlogPost = {
  slug: "dupr-thepicklehub-user-guide",
  publishedDate: "2026-05-29",
  updatedDate: "2026-05-29",
  author: "Cuong Nguyen",
  tags: [
    "dupr thepicklehub",
    "dupr integration",
    "dupr vietnam",
    "pickleball rating vietnam",
    "dupr connect",
    "log pickleball match",
    "dupr leaderboard vietnam",
    "pickleball thepicklehub",
  ],
  ctaPath: "/dupr",
  ctaLabel: {
    en: "Connect Your DUPR Account Now",
    vi: "Kết Nối Tài Khoản DUPR Ngay",
  },
  heroImage: {
    src: "/images/blog/dupr-thepicklehub-user-guide-hero.webp",
    alt: "A 16:9 editorial product hero showing the ThePickleHub.net dashboard on a laptop, featuring a green Connect DUPR header button, a DUPR rating pill displaying singles 4.27 and doubles 4.41, and a 30-day rating history line chart in the background, with subtle pickleball paddle and ball props and a faint Vietnam map outline, illustrating the 2026 DUPR integration user guide for ThePickleHub.",
  },
  content: {
    en: {
      title:
        "DUPR on ThePickleHub: Complete User Guide 2026 — Connect, Log Matches, Rankings",
      metaTitle:
        "DUPR on ThePickleHub Guide 2026 | Connect + Log Matches",
      metaDescription:
        "Connect DUPR to ThePickleHub in one click, log matches with opponent confirmation, submit to DUPR, and track your rating on the Vietnam DUPR leaderboard.",
      sections: [
        {
          heading: "Why DUPR on ThePickleHub matters",
          content:
            "DUPR (Dynamic Universal Pickleball Rating) is the global rating system used by the PPA Tour, MLP, USA Pickleball, the Pickleball World Cup, and the TA Pickleball circuit in Vietnam. If you play competitive pickleball anywhere in 2026 — from a Hanoi club night to the PPA Tour Asia stops — your DUPR is the number that decides which bracket you enter, who you partner with, and how the algorithm reads your wins and losses. ThePickleHub is an official DUPR Partner in Vietnam. That means the integration is not screen-scraping or a third-party hack. It is a sanctioned data pipeline: matches you log on ThePickleHub flow directly into the DUPR ledger, ratings come back via webhook, and the Vietnam DUPR Leaderboard refreshes weekly from DUPR's official snapshot. This guide walks through the entire flow — connecting your DUPR account in one click, logging matches from your club, getting your opponent to confirm, having your club admin submit to DUPR, watching your rating update in seconds, and joining DUPR-required tournaments. Every section maps to actual behavior in the production app as of May 2026 after the Phase 3 DUPR-spec compliant ship.",
          internalLinks: [
            {
              text: "Part 1 of the DUPR series covers what DUPR is, who runs it, and why Vietnamese players need it",
              path: "/blog/what-is-dupr-pickleball-rating-system",
            },
            {
              text: "The DUPR Vietnam partnership announcement explains how TA Pickleball, DUPR, and ThePickleHub teamed up for this rollout",
              path: "/blog/dupr-vietnam-partnership-ta-pickleball-thepicklehub",
            },
          ],
        },
        {
          heading: "Connect DUPR in one click",
          content:
            "Sign in to ThePickleHub. Look at the header — top-right corner, next to the notification bell. You will see a green Connect DUPR button. Click it. A DUPR authentication window opens. Sign in to your DUPR account. Done. That is the entire connect flow. One click. One-time setup. From that point on, your DUPR account is bonded to your ThePickleHub profile and every match, club, tournament, and rating update syncs automatically. No DUPR account yet? Create one for free at dupr.com, grant ThePickleHub permission during your first DUPR login, then come back and click Connect. Five minutes total. If the Connect DUPR button does not appear in the header, refresh the page. If it still does not show, go directly to thepicklehub.net/dupr to connect.",
          internalLinks: [
            {
              text: "Go to the connect page directly",
              path: "/dupr",
            },
          ],
        },
        {
          heading: "Rating auto-updates via webhook",
          content:
            "Once connected, your DUPR singles and doubles ratings display in the header as a pill: DUPR 4.27 / 4.41. The left number is singles, the right is doubles, both to the two-decimal precision DUPR provides. Click the pill to open your /dupr page, which gives you your current singles and doubles ratings, a 30-day rating history line chart, your DUPR ID and the date you connected, a direct link to open your DUPR profile, and a Disconnect button if you ever need to unlink. The update mechanism: every time DUPR recalculates your rating — after a match, after a weekly recalc — DUPR pushes a webhook directly to ThePickleHub. The dupr-webhook edge function receives the payload, writes a new row to dupr_rating_history, and updates your profile. End-to-end, in seconds. You do nothing. You play, DUPR calculates, ThePickleHub updates, your header pill changes, your chart adds a new point. The Vietnam DUPR Leaderboard at thepicklehub.net/rankings updates weekly from DUPR's public snapshot via the dupr-refresh.yml cron — top Vietnamese and Southeast Asian players, ranked by current DUPR doubles and singles. The leaderboard is independent of who has connected on ThePickleHub; it reflects the global DUPR rankings filtered to Vietnam.",
          internalLinks: [
            {
              text: "View the live Vietnam DUPR Leaderboard",
              path: "/rankings",
            },
            {
              text: "The leaderboard launch story explains how the webhook pipeline was built end-to-end",
              path: "/blog/vietnam-dupr-leaderboard-launch",
            },
          ],
        },
        {
          heading: "Log a match: member flow (4 steps)",
          content:
            "Logging a match is the most important feature, and the one that was redesigned in May 2026 to match the DUPR Partner Spec. Members log their own matches, but the DUPR-required TD/admin/club-organizer-only submission rule is preserved. Step 1: enter the score. Open your club page, click + Log match. A single dialog wizard appears. Search for your opponent — the smart search returns both DUPR-connected players and ThePickleHub members in one box. Recent opponents are suggested. Singles and doubles both supported. Mandatory rule: when you log a match as a member, you must be on team A. You cannot log somebody else's match without being part of it. Step 2: opponent confirms the score. After save, the match enters pending_opponent_confirm. The opponent (any one of team B's players for doubles) opens /match/confirm, taps Confirm score, match transitions to confirmed. Why confirm? Not a DUPR requirement — this is ThePickleHub's data-integrity layer. It blocks the obvious abuse vector of one player unilaterally claiming a win. Step 3: club admin submits to DUPR. Per the DUPR Partner Spec (2026 update), only TDs, admins, or club organizers can submit matches to DUPR. Members cannot self-submit even after opponent confirmation. The club admin sees the match on the club page with a badge: Confirmed by opponent — ready to submit. One click on Submit to DUPR. Step 4: DUPR scores it and webhooks back. The DUPR API returns a matchCode, which ThePickleHub mirrors into matches.dupr_match_id. Within a few hours DUPR recalculates the four players' ratings and pushes a webhook, and ratings update everywhere on ThePickleHub.",
          orderedList: [
            "Enter the score in the wizard — pick opponent, set games won, save.",
            "Opponent receives a notification (or sees it in their /match/confirm queue) and taps Confirm score.",
            "Club admin opens the club page, sees the Confirmed by opponent badge, clicks Submit to DUPR.",
            "DUPR computes the rating update; webhook fires; rating pills and history chart refresh.",
          ],
          internalLinks: [
            {
              text: "Open your confirm queue",
              path: "/match/confirm",
            },
          ],
        },
        {
          heading: "Log a match: admin / club organizer flow (2 steps)",
          content:
            "If you are the creator or manager of the club (in clubs.created_by or in club_managers), your log-match wizard is reduced to two steps. Step 1: enter the score — same UI, no must be on team A constraint. You can log any member's match in your club. Step 2: submit to DUPR directly. Status jumps straight to auto_confirmed_admin and you click Submit. Match status badges on the club page tell you what action is next. Waiting for opponent (amber) means member-logged, awaiting team B confirm — no action available, just wait. Confirmed by opponent (gold) means both sides have confirmed — click Submit to DUPR. Ready (gold) means admin-logged auto-confirmed — click Submit to DUPR. Submitted (green) means the match is on DUPR — displays matchCode plus hashedMatchCode for traceability.",
        },
        {
          heading: "Club integration with DUPR",
          content:
            "Club owners on ThePickleHub can link their club to an official DUPR Club — the effect is that submitted matches carry matchSource=CLUB plus the DUPR clubId, which DUPR's algorithm treats with much higher weight than self-logged play. Roles and permissions: Creator (the club owner, stored in clubs.created_by) has full control — log matches, confirm matches, link DUPR, add managers. Manager (rows in club_managers) can log, confirm, and submit matches for that club only. Member can log matches with opponent confirmation (the four-step flow above). Multi-manager support: a club can have multiple managers. Each can confirm and submit independently. Operations stay collective instead of bottlenecked on one person. Why match weight matters: DUPR's algorithm assigns weight to a match by matchSource. A match submitted under a linked DUPR Club (matchSource=CLUB) influences your rating several times more than a self-submitted PARTNER-source match. Higher weight, faster signal, more accurate rating. To unlock CLUB-weight submission, your club needs a dupr_club_id set by a DUPR admin. Matches still submit successfully on the PARTNER source if your club is not yet linked, but the weight is lower. Contact the ThePickleHub admin team to link your club to a DUPR Club.",
          internalLinks: [
            {
              text: "Part 2 of the DUPR series explains the match-weight math in full — why winning can lose points and losing can gain them",
              path: "/blog/dupr-algorithm-explained-performance-vs-expectation",
            },
          ],
        },
        {
          heading: "DUPR-required tournaments",
          content:
            "Running a tournament on ThePickleHub? You can gate registration by DUPR rating. How it works: the tournament organizer sets the requirement (BASIC_L1 for DUPR connected, PREMIUM_L1 for DUPR+ premium member, or a min/max rating threshold). When a user clicks Register, the dupr-event-eligibility edge function checks their entitlement and rating. Not connected to DUPR — message: please connect first. Rating below threshold — blocked with a clear message that shows current rating versus the event threshold. Eligible — registration continues normally. Under the hood, the DuprEntitlementGate component wraps the Register button, calling the dupr_user_has_entitlement RPC with a 24-hour cache and a fallback to DUPR's /subscription/active endpoint if the cache is stale. The payoff: rated tournaments mean balanced brackets, balanced brackets mean better matches, and nobody complains he was too strong or she was too weak because the math already filtered.",
        },
        {
          heading: "Edit and delete matches",
          content:
            "Typed the wrong score? Logged the wrong opponent? DUPR lifecycle operations support both. Update: the dupr-match-submit edge function with action update sends a new payload with the same internal_match_id — DUPR reverses the previous rating impact and applies the new score. Delete: action delete removes the match from DUPR's rating ledger and recalculates affected players. Permissions: same as Submit — only global admins and club creators/managers. Members cannot edit or delete their own matches (this blocks the fix the score after a loss abuse path). Current UX: update and delete go through /admin/dupr (Operator Dashboard) or direct DB for admins. A per-row public UI is shipping next.",
        },
        {
          heading: "Security and DUPR compliance",
          content:
            "ThePickleHub is an official DUPR Partner, not a regular user calling the API. The full stack respects the DUPR Partner Spec. TD/admin/club-organizer-only submission — members route through the opponent-confirm flow, but the final Submit button stays with the organizer. BASIC_L1 entitlement is required for every player in a submitted match — lazy-fetched and cached if missing. Consent-based player search — only players who have granted ThePickleHub consent appear in the search box. Token isolation — DUPR user tokens live in dupr_user_tokens with column-level grants. The frontend never sees access_token or refresh_token. Webhook signature verification — DUPR webhooks are signature-verified before any DB write. The result: rating data you can trust, with the same compliance posture as a sanctioned DUPR venue.",
          internalLinks: [
            {
              text: "Part 3 of the DUPR series is a 30-day plan to improve your DUPR — useful once you have the integration working",
              path: "/blog/dupr-rating-improvement-30-day-plan",
            },
          ],
        },
        {
          heading: "DUPR on ThePickleHub FAQ",
          content:
            "Six questions cover almost every follow-up after a first run through the connect and log-match flow — entitlement errors, missing Submit buttons, rating delays, multi-account behavior, notifications, and club weight.",
        },
      ],
      faqItems: [
        {
          question: "I connected DUPR but submission fails with \"players_missing_basic_l1\" — why?",
          answer:
            "A player's BASIC_L1 entitlement cache may not be populated yet. ThePickleHub lazy-fetches on the first submission attempt. Try Submit again — the system fetches and caches the entitlement, and the second attempt succeeds.",
        },
        {
          question: "A member logged a match but I (the club admin) don't see a Submit button — what's missing?",
          answer:
            "The Submit button only appears when confirmation_status equals 'confirmed'. The opponent has to tap Confirm on their /match/confirm page first. Ping them to confirm and the badge plus button appear on your club page automatically.",
        },
        {
          question: "My rating didn't update after a match — is something broken?",
          answer:
            "DUPR needs time to score (usually a few hours to a day). The webhook fires automatically when DUPR is done. Open /dupr to see your rating history chart, or click View on DUPR for the source-of-truth on dupr.com.",
        },
        {
          question: "I have two DUPR accounts — can I use either for ThePickleHub?",
          answer:
            "One ThePickleHub user equals one DUPR account. Migration 20260518000000_dupr_one_account_per_user.sql enforces this at the database level. Connecting a different DUPR account revokes the previous link.",
        },
        {
          question: "I'm not getting notifications when an opponent logs a match against me — bug?",
          answer:
            "Notifications for the confirm flow are not yet wired to email or push. For now, check /match/confirm manually. Push and email notifications for the confirm queue are shipping in the next product update.",
        },
        {
          question: "Can my club still benefit if we are not yet a linked DUPR Club?",
          answer:
            "Submission still works through the PARTNER source, but the weight is lower than a linked DUPR Club. To unlock CLUB-source weight, reach out to the ThePickleHub admin team to start the DUPR Club link process for your venue — once dupr_club_id is set, every future submission carries matchSource=CLUB.",
        },
      ],
    },
    vi: {
      title: "Hướng Dẫn Dùng DUPR Trên ThePickleHub 2026 | Connect, Log Trận, Bảng Xếp Hạng",
      metaTitle: "Dùng DUPR Trên ThePickleHub 2026 | Connect + Log Trận",
      metaDescription:
        "Kết nối DUPR với ThePickleHub trong 1-click, log trận đấu có đối thủ xác nhận, admin submit lên DUPR — và theo dõi rating trên bảng xếp hạng DUPR Việt Nam.",
      sections: [
        {
          heading: "Vì sao DUPR trên ThePickleHub quan trọng",
          content:
            "DUPR (Dynamic Universal Pickleball Rating) là hệ rating toàn cầu được dùng bởi PPA Tour, MLP, USA Pickleball, Pickleball World Cup, và TA Pickleball circuit tại Việt Nam. Nếu bạn chơi pickleball thi đấu trong năm 2026 — từ giải club Hà Nội đến các stops PPA Tour Asia — DUPR là con số quyết định bạn vào bracket nào, ghép cặp với ai, và cách thuật toán đọc thắng-thua của bạn. ThePickleHub là DUPR Partner chính thức tại Việt Nam. Điều đó nghĩa là tích hợp không phải screen-scraping hay third-party hack. Đây là pipeline dữ liệu chính thức: trận đấu bạn log trên ThePickleHub được submit thẳng vào DUPR ledger, rating quay về qua webhook, và bảng xếp hạng DUPR Việt Nam cập nhật hàng tuần từ snapshot chính thức của DUPR. Bài này đi qua toàn bộ flow — connect DUPR trong 1-click, log trận đấu từ CLB, đối thủ xác nhận, admin CLB submit lên DUPR, rating update trong vài giây, và tham gia giải đấu yêu cầu DUPR. Mọi mục đều khớp với production app tính đến tháng 5/2026 sau khi ship Phase 3 DUPR-spec compliant.",
          internalLinks: [
            {
              text: "Phần 1 của series DUPR giải thích DUPR là gì, ai vận hành, và vì sao người chơi VN cần biết",
              path: "/vi/blog/dupr-la-gi-he-thong-rating-pickleball-toan-cau",
            },
            {
              text: "Công bố hợp tác DUPR Việt Nam giải thích TA Pickleball, DUPR và ThePickleHub bắt tay thế nào cho rollout này",
              path: "/vi/blog/cong-bo-hop-tac-dupr-viet-nam-ta-pickleball",
            },
          ],
        },
        {
          heading: "Kết nối DUPR trong 1-click",
          content:
            "Đăng nhập ThePickleHub. Nhìn vào header — góc trên bên phải, kế bên chuông thông báo. Bạn sẽ thấy nút Kết nối DUPR màu xanh. Click. Cửa sổ authentication DUPR mở ra. Đăng nhập tài khoản DUPR của bạn. Xong. Đó là toàn bộ flow connect. Một click. Setup một lần duy nhất. Từ điểm này tài khoản DUPR của bạn gắn liền với profile ThePickleHub, và mọi trận đấu, CLB, giải đấu, cập nhật rating đều sync tự động. Chưa có tài khoản DUPR? Tạo miễn phí tại dupr.com, cấp permission cho ThePickleHub trong lần đăng nhập đầu tiên, rồi quay lại bấm Connect. Tổng cộng 5 phút. Nếu nút Kết nối DUPR không hiện trên header, refresh trang. Vẫn không thấy → vào trực tiếp thepicklehub.net/dupr để connect.",
          internalLinks: [
            {
              text: "Vào trang connect trực tiếp",
              path: "/dupr",
            },
          ],
        },
        {
          heading: "Rating tự động cập nhật qua webhook",
          content:
            "Sau khi connect, rating đơn và đôi của bạn hiển thị ngay trên header dưới dạng pill: DUPR 4.27 / 4.41. Bên trái là điểm đơn, bên phải là điểm đôi, cùng độ chính xác hai chữ số DUPR cung cấp. Click vào pill để mở trang /dupr, nơi bạn xem được điểm đơn và đôi hiện tại, biểu đồ rating 30 ngày gần nhất, DUPR ID + ngày connect, link mở trực tiếp profile DUPR của bạn, và nút Disconnect nếu cần ngắt. Cơ chế cập nhật: Mỗi khi DUPR chấm lại rating của bạn — sau trận đấu, sau kỳ recalc tuần — DUPR push một webhook thẳng về ThePickleHub. Edge function dupr-webhook nhận payload, ghi 1 row mới vào dupr_rating_history, và cập nhật profile. End-to-end, trong vài giây. Bạn không cần làm gì. Đánh xong, DUPR tính, ThePickleHub cập nhật, pill header thay đổi, biểu đồ thêm 1 điểm. Bảng xếp hạng DUPR Việt Nam tại thepicklehub.net/rankings cập nhật hàng tuần từ DUPR snapshot public qua cron dupr-refresh.yml — top player Việt Nam và Đông Nam Á, xếp theo DUPR đôi và đơn hiện tại. Bảng độc lập với ai đã connect trên ThePickleHub; nó phản ánh ranking toàn cầu của hệ DUPR lọc theo Việt Nam.",
          internalLinks: [
            {
              text: "Xem bảng xếp hạng DUPR Việt Nam trực tiếp",
              path: "/vi/rankings",
            },
            {
              text: "Câu chuyện ra mắt bảng xếp hạng giải thích pipeline webhook end-to-end",
              path: "/vi/blog/bang-xep-hang-dupr-viet-nam-ra-mat",
            },
          ],
        },
        {
          heading: "Log trận đấu: member flow (4 bước)",
          content:
            "Log trận là tính năng quan trọng nhất, và đã được redesign theo đúng spec của DUPR (5/2026). Cho phép member tự log nhưng giữ rule TD/admin/club-organizer only của DUPR cho phần submit. Bước 1: Nhập tỉ số. Mở trang CLB, bấm + Log match. Wizard 1 dialog hiện ra. Search đối thủ — ô search thông minh trả cả player đã connect DUPR lẫn member ThePickleHub trong cùng 1 ô. Recent opponents được gợi ý. Hỗ trợ cả đơn lẫn đôi. Quy tắc bắt buộc: Khi log với vai trò member, bạn phải có mặt trong team A. Không thể log trận của người khác mà không có sự tham gia. Bước 2: Đối thủ xác nhận tỉ số. Sau khi save, trận chuyển sang pending_opponent_confirm. Đối thủ (chỉ cần 1 trong 2 với đôi) mở /match/confirm, bấm Xác nhận tỉ số, trận sang confirmed. Tại sao cần confirm? Không phải DUPR yêu cầu. Đây là tầng data integrity của ThePickleHub — chống user một mình claim chiến thắng. Bước 3: Admin CLB submit lên DUPR. Theo spec DUPR (2026), chỉ TD/admin/club-organizer mới được submit. Member không thể tự submit, kể cả khi opponent đã confirm. Admin/Manager vào trang CLB, thấy trận với badge Confirmed by opponent — ready to submit, bấm Submit to DUPR một click. Bước 4: DUPR chấm rating + webhook push lại. DUPR API trả về matchCode → ThePickleHub mirror về matches.dupr_match_id. Trong vài giờ, DUPR recalc rating 4 player → push webhook → rating update khắp ThePickleHub.",
          orderedList: [
            "Nhập tỉ số trong wizard — chọn đối thủ, set games won, save.",
            "Đối thủ nhận notification (hoặc thấy trong /match/confirm queue) và bấm Xác nhận tỉ số.",
            "Admin CLB mở trang CLB, thấy badge Confirmed by opponent, bấm Submit to DUPR.",
            "DUPR tính rating; webhook fire; pill rating + biểu đồ history tự refresh.",
          ],
          internalLinks: [
            {
              text: "Mở queue confirm của bạn",
              path: "/match/confirm",
            },
          ],
        },
        {
          heading: "Log trận đấu: admin / CLB organizer flow (2 bước)",
          content:
            "Nếu bạn là creator hoặc manager của CLB (clubs.created_by hoặc club_managers), wizard rút còn 2 bước. Bước 1: Nhập tỉ số — UI tương tự nhưng không ràng buộc phải có mặt team A. Bạn có thể log trận của bất kỳ member nào trong CLB. Bước 2: Submit to DUPR trực tiếp. Status nhảy auto_confirmed_admin ngay, không đợi opponent. Badge status trên trang CLB cho bạn biết bước tiếp theo. Đợi đối thủ confirm (amber) nghĩa là member-logged, chờ team B confirm — không thao tác được, đợi. Đối thủ đã confirm (gold) nghĩa là hai phía OK — bấm Submit to DUPR. Sẵn sàng (gold) nghĩa là admin-logged auto-confirmed — bấm Submit to DUPR. Đã submit (green) nghĩa là trận đã lên DUPR — hiển thị matchCode + hashedMatchCode để traceability.",
        },
        {
          heading: "CLB tích hợp DUPR",
          content:
            "Chủ CLB trên ThePickleHub có thể link CLB với một CLB DUPR chính thức — kết quả: mọi trận được duyệt sẽ submit với matchSource=CLUB + clubId, được DUPR algorithm đối xử với trọng số cao hơn nhiều so với trận tự log. Quyền và phân chia: Creator (chủ CLB, clubs.created_by) — toàn quyền — log, confirm, link DUPR, thêm manager. Manager (club_managers) — được log, confirm, submit cho CLB đó (không phải CLB khác). Member — log trận có sự xác nhận của đối thủ (Phase 2 flow). Multi-manager: 1 CLB có thể có nhiều manager. Mỗi người được confirm + submit độc lập. Quản trị tập thể chứ không kẹt một người. Trọng số quan trọng: DUPR algorithm đánh trọng số trận theo matchSource. Trận submit từ DUPR Club đã link (matchSource=CLUB) ảnh hưởng rating cao gấp nhiều lần so với trận PARTNER-source. Trọng số cao = signal mạnh = rating chính xác hơn. Để được CLUB-weight, CLB phải có dupr_club_id được set bởi admin DUPR. Trận vẫn submit thành công qua source PARTNER nếu CLB chưa link — nhưng weight thấp hơn. Liên hệ admin ThePickleHub để link CLB của bạn với DUPR Club.",
          internalLinks: [
            {
              text: "Phần 2 series DUPR giải thích chi tiết math về match weight — vì sao thắng có thể mất điểm, thua có thể tăng điểm",
              path: "/vi/blog/thuat-toan-dupr-vi-sao-thang-mat-diem",
            },
          ],
        },
        {
          heading: "Giải đấu yêu cầu DUPR",
          content:
            "Tổ chức giải đấu trên ThePickleHub? Bạn có thể set điều kiện đăng ký theo DUPR. Cách hoạt động: Organizer set yêu cầu — BASIC_L1 (tất cả player connect DUPR), PREMIUM_L1 (DUPR+ premium member), hoặc threshold rating tối thiểu/tối đa. User click đăng ký: edge function dupr-event-eligibility check entitlement + rating. Chưa connect DUPR → message yêu cầu connect trước. Rating thấp hơn yêu cầu → block với message rõ (kèm hiển thị rating hiện tại vs ngưỡng giải). Đủ điều kiện → register tiếp. Bên dưới: component DuprEntitlementGate bao bọc nút Register, RPC dupr_user_has_entitlement check cache 24h, fallback gọi DUPR /subscription/active nếu cache expired. Tác động: Giải đấu rated chuẩn → trình độ player đồng đều → bracket không lệch → không cãi nhau anh ấy quá mạnh hay chị ấy quá yếu vì toán đã lọc trước.",
        },
        {
          heading: "Sửa và xoá trận",
          content:
            "Nhập sai tỉ số? Log nhầm đối thủ? DUPR lifecycle ops hỗ trợ cả hai. Update: Edge function dupr-match-submit action update — gửi payload mới (cùng internal_match_id) → DUPR đảo ngược tác động rating cũ + áp dụng tỉ số mới. Delete: Action delete — DUPR xoá trận khỏi rating ledger + recalc lại cho mọi player liên quan. Quyền sửa/xoá: Cùng rule với Submit — chỉ admin global + creator/manager CLB. Member không tự sửa/xoá được trận của mình (chống user fix tỉ số sau submit để gian lận). UX hiện tại: Update/delete đi qua /admin/dupr (Operator Dashboard) hoặc DB trực tiếp cho admin. UI public per-row đang được hoàn thiện.",
        },
        {
          heading: "Bảo mật và tuân thủ DUPR",
          content:
            "ThePickleHub là DUPR Partner chính thức, không phải user thường gọi API. Mọi thứ tuân thủ DUPR Partner Spec. Chỉ TD/admin/club-organizer được submit — member submit qua opponent-confirm flow, nhưng nút Submit cuối cùng vẫn ở organizer — đúng tinh thần DUPR. BASIC_L1 entitlement bắt buộc cho mọi player trong trận — auto lazy-fetch nếu cache miss. Consent-based player search — chỉ player đã cấp consent cho ThePickleHub mới hiện trong ô search. Token isolation — DUPR user tokens lưu ở dupr_user_tokens với column-level grant. Frontend không bao giờ thấy access_token / refresh_token. Webhook signature verification — DUPR webhook được verify signature trước khi update DB. Kết quả: rating data đáng tin, với compliance posture giống một sanctioned DUPR venue.",
          internalLinks: [
            {
              text: "Phần 3 series DUPR là kế hoạch 30 ngày tăng DUPR — hữu ích khi bạn đã chạy tích hợp xong",
              path: "/vi/blog/tang-dupr-30-ngay-ke-hoach-thuc-te",
            },
          ],
        },
        {
          heading: "FAQ — Dùng DUPR trên ThePickleHub",
          content:
            "Sáu câu hỏi bao quát phần lớn follow-up sau lần đầu chạy flow connect + log trận — entitlement error, thiếu nút Submit, rating delay, multi-account, notification, và club weight.",
        },
      ],
      faqItems: [
        {
          question: "Tôi connect DUPR rồi nhưng admin submit báo \"players_missing_basic_l1\" — vì sao?",
          answer:
            "Có thể cache entitlement của một player chưa được populate. ThePickleHub tự lazy-fetch lần đầu submit — thử Submit lại lần nữa, hệ thống sẽ fetch + cache cho lần sau và lần thử thứ 2 thành công.",
        },
        {
          question: "Member log trận xong nhưng tôi (admin) không thấy nút Submit — thiếu gì?",
          answer:
            "Nút Submit chỉ xuất hiện khi confirmation_status = 'confirmed'. Đối thủ phải bấm Confirm trên /match/confirm của họ trước. Ping nhắc họ confirm, badge + nút sẽ tự hiện trên trang CLB của bạn.",
        },
        {
          question: "Rating của tôi không cập nhật sau trận đấu — có lỗi gì không?",
          answer:
            "DUPR cần thời gian chấm rating (thường vài giờ tới 1 ngày). Webhook tự push khi DUPR xong. Vào /dupr để xem biểu đồ history, hoặc click Xem trên DUPR để check trực tiếp dupr.com.",
        },
        {
          question: "Tôi có 2 tài khoản DUPR — dùng cái nào cho ThePickleHub?",
          answer:
            "1 user ThePickleHub = 1 DUPR account. Migration 20260518000000_dupr_one_account_per_user.sql enforce điều này ở DB level. Nếu connect tài khoản DUPR khác, link cũ sẽ bị revoke.",
        },
        {
          question: "Không nhận được notification khi đối thủ log trận — bug?",
          answer:
            "Notification qua email/push chưa được wire xong cho confirm flow. Hiện tại bạn cần chủ động vào /match/confirm để check. Push + email notification cho confirm queue sẽ ship trong update tới.",
        },
        {
          question: "CLB tôi chưa phải DUPR Club — vẫn submit được không?",
          answer:
            "Submit vẫn work qua source PARTNER nhưng weight thấp hơn DUPR Club. Để unlock CLUB-source weight, liên hệ admin ThePickleHub để bắt đầu quy trình link CLB với DUPR Club — khi dupr_club_id được set xong, mọi trận tương lai sẽ carry matchSource=CLUB.",
        },
      ],
    },
  },
};

export default post;
