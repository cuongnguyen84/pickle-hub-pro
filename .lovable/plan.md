
## 30-Day Security Hardening Plan

### Tuần 1-2: Security Hardening (P0)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 1 | `send-auth-email`: Xoá nhánh "manual request", verify HMAC với `SEND_EMAIL_HOOK_SECRET` | ✅ Done | `supabase/functions/send-auth-email/index.ts` |
| 2 | `mux-webhook`: Thêm Mux signature verification (`MUX_WEBHOOK_SECRET`) | ✅ Done | `supabase/functions/mux-webhook/index.ts` |
| 3 | `ant-media-webhook`: Thêm shared secret check (custom header/query param) | 🔲 Todo | `supabase/functions/ant-media-webhook/index.ts` |
| 4 | `batch-view-events`: Bỏ nhận `viewer_user_id`/`organization_id` từ client, tự lookup từ `target_id`. Thêm rate limit | 🔲 Todo | `supabase/functions/batch-view-events/index.ts` |

### Tuần 2-3: Data Integrity (P1)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 5 | `geo-check`: Chuyển sang HTTPS IP lookup service | 🔲 Todo | `supabase/functions/geo-check/index.ts` |
| 6 | Audit Log Phase 2: diff view UI, export CSV/JSON, search | 🔲 Todo | `src/pages/admin/AdminAuditLog.tsx` |
| 7 | Thêm audit events cho auth (login success/failed) | 🔲 Todo | `supabase/functions/send-auth-email/index.ts` |

### Tuần 3-4: Code Quality (P2)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 8 | Refactor `useQuickTable.ts` — tách mutations ra file riêng | 🔲 Todo | `src/hooks/useQuickTable.ts` |
| 9 | Refactor `useDoublesElimination.ts` — tách scoring logic | 🔲 Todo | `src/hooks/useDoublesElimination.ts` |

---

### Đánh giá AI Review (lưu lại)

| Tiêu chí | Điểm |
|----------|------|
| Architecture | 6.5/10 |
| Code Quality | 6/10 |
| Performance | 5.5/10 |
| **Security** | **4/10** |
| DevOps | 3/10 |
| Business Fit | 8/10 |
| Maintainability | 5.5/10 |
