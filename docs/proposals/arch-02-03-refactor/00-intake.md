# Intake — arch-02-03-refactor

**Ý tưởng gốc:** cụm 4/4 chuỗi "tiếp tục các tác vụ cải tiến" (Cuong chốt 2026-07-17): ARCH-02 + ARCH-03, hai task "later" cuối của Phase 4 roadmap (docs/roadmap-8.5-9.md:200-201, mỗi cái 5d, dependency ARCH-01 done PR #334).

- **ARCH-02:** Refactor Social Event registration/payment into domain/application/infrastructure/UI layers.
- **ARCH-03:** Refactor Team Match orchestration and realtime boundaries.

**Bối cảnh mới cần tính:** ARCH-04 vừa HOÀN TẤT (17/07, #357-377) — scoring core + RefereeScoringScreen + realtime spectator + quy tắc đứng "tính năng scoring mới vào engine, không vào trang format". DB-02 (bracket advancement transactional) cũng done. Phần "realtime boundaries" của ARCH-03 có thể đã được ARCH-04 ăn mất một phần.

**Ai dùng:** nội bộ — giảm rủi ro khi sửa 2 domain phức tạp nhất (đăng ký/thanh toán event, orchestration team match).

**Thành công:** ranh giới lớp rõ (theo docs/architecture-boundaries.md của ARCH-01), diff về sau trong 2 domain này nhỏ và test được; không đổi hành vi user.

**Câu hỏi mở cho panel:** làm cả hai hay một; cái nào trước; scope thật còn lại của ARCH-03 sau ARCH-04.

**Ràng buộc:** payment là money-path (QA-08 đã có test handler `_shared`); realtime có gotcha publication drift; 2 task này nặng nhất backlog — phải chia lát ship được.
