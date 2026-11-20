/** Score commit boundary shared by mutation callers. Resolves only on success. */
export class QuickTableScoreSaveError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "QuickTableScoreSaveError";
  }
}
interface ScoreStore {
  fetchVersion(): Promise<{ data: { score_version: number } | null; error: unknown }>;
  commit(version: number): Promise<{ data: unknown; error: unknown }>;
}
interface Feedback {
  error(message: string): void;
  permissionDenied: string;
  log(error: unknown): void;
}
export async function saveQuickTableScore(store: ScoreStore, feedback: Feedback): Promise<void> {
  const lookup = await store.fetchVersion();
  if (lookup.error || !lookup.data) {
    feedback.log(lookup.error);
    feedback.error("Không thể lưu điểm.");
    throw new QuickTableScoreSaveError("SCORE_LOOKUP_FAILED");
  }
  const response = await store.commit(lookup.data.score_version);
  const result = (response.data ?? {}) as Record<string, unknown>;
  if (!response.error && result.success === true) return;
  feedback.log(response.error || result);
  const code = typeof result.error === "string" ? result.error : "SCORE_SAVE_FAILED";
  const pgCode = response.error && typeof response.error === "object" && "code" in response.error
    ? response.error.code : null;
  feedback.error(pgCode === "42501" ? feedback.permissionDenied
    : code === "VERSION_CONFLICT" ? "Điểm vừa được cập nhật ở thiết bị khác. Hãy tải lại."
    : code === "DOWNSTREAM_LOCKED" ? "Không thể sửa vì trận tiếp theo đã bắt đầu."
    : typeof result.error === "string" ? result.error : "Không thể lưu điểm.");
  throw new QuickTableScoreSaveError(code);
}
