/**
 * Platform detection.
 *
 * Capacitor nghỉ hưu 2026-08-24: bản iOS trên App Store đã được app native
 * `/apple` thay thế, bản Android chưa bao giờ phát hành. Bundle này giờ chỉ
 * chạy trong trình duyệt, nên chỉ còn lại phép thử user-agent cho iOS Safari
 * (dùng để chừa chỗ cho thanh Home indicator).
 */
export const isIOS = (): boolean => /iPhone|iPad|iPod/.test(navigator.userAgent);
