// ADMIN-MFA: một khi user đã enroll factor MFA verified, mọi đặc quyền role
// admin qua edge function phải đi kèm phiên aal2 — đồng bộ với guard trong
// is_admin() ở DB (migration 20260730090000). Chưa enroll thì không đổi
// hành vi (self-activating, không lock-out).
//
// Dùng: sau khi đã xác nhận role admin, gọi adminSessionAalOk(user, token);
// false -> trả 403. Với nhánh "admin cũng được phép" (vd dupr-user-search),
// coi isAdmin = isAdmin && adminSessionAalOk(...) để rơi về hành vi thường.

export function bearerToken(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

export function adminSessionAalOk(
  user: { factors?: Array<{ status?: string | null }> | null },
  jwt: string,
): boolean {
  const enrolled = (user.factors ?? []).some((f) => f.status === "verified");
  if (!enrolled) return true;
  try {
    const b64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return payload.aal === "aal2";
  } catch {
    return false; // token đọc không ra -> chặn (fail closed, chỉ khi đã enroll)
  }
}
