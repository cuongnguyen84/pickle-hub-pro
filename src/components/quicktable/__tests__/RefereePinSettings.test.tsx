// @vitest-environment jsdom
// Behaviour tests for the organizer-side PIN controls: initial load, enable
// (generates + reveals), disable (confirm → clear), rotate, copy, mask toggle,
// and the offline guard.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import RefereePinSettings from '../RefereePinSettings';

const { getMock, setMock, clearMock, toastSuccess, toastError, confirmMock, clipboardWrite } =
  vi.hoisted(() => ({
    getMock: vi.fn(),
    setMock: vi.fn(),
    clearMock: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    confirmMock: vi.fn(),
    clipboardWrite: vi.fn(),
  }));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

vi.mock('@/lib/referee-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/referee-helpers')>();
  return {
    ...actual,
    getRefereePin: (...a: unknown[]) => getMock(...a),
    setRefereePin: (...a: unknown[]) => setMock(...a),
    clearRefereePin: (...a: unknown[]) => clearMock(...a),
  };
});

vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => confirmMock }));

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      referee: {
        pin: {
          switchLabel: 'Cho phép vào bằng mã PIN',
          hint: 'Người đã đăng nhập có thể nhập mã này.',
          expiryNote: 'Mã tự hết hiệu lực khi giải kết thúc.',
          codeLabel: 'Mã PIN trọng tài',
          show: 'Hiện mã PIN',
          hide: 'Ẩn mã PIN',
          copy: 'Sao chép mã',
          copied: 'Đã sao chép mã PIN.',
          rotate: 'Tạo mã mới',
          rotateConfirmTitle: 'Tạo mã PIN mới?',
          rotateConfirmBody: 'Mã hiện tại sẽ ngừng hoạt động ngay.',
          disableConfirmTitle: 'Tắt mã PIN?',
          disableConfirmBody: 'Người mới sẽ không thể tham gia.',
          disableConfirmCancel: 'Giữ mã PIN',
          disableConfirmOk: 'Tắt mã PIN',
          updateError: 'Không thể cập nhật mã PIN.',
          enabling: 'Đang tạo mã PIN…',
        },
      },
    },
  }),
}));

const setOnline = (v: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value: v, configurable: true });

beforeEach(() => {
  vi.clearAllMocks();
  setOnline(true);
  Object.assign(navigator, { clipboard: { writeText: (...a: unknown[]) => clipboardWrite(...a) } });
});
afterEach(cleanup);

describe('RefereePinSettings — load', () => {
  it('renders an active PIN masked, then reveals on demand', async () => {
    getMock.mockResolvedValue({ pin: '123456', is_active: true });
    render(<RefereePinSettings format="quick_table" parentId="p1" />);
    await waitFor(() => expect(getMock).toHaveBeenCalledWith('quick_table', 'p1'));
    // masked initially
    expect((await screen.findByLabelText('Mã PIN trọng tài')).textContent).toContain('••• •••');
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mã PIN' }));
    expect(screen.getByLabelText('Mã PIN trọng tài').textContent).toContain('123 456');
  });

  it('shows only the hint when no PIN exists', async () => {
    getMock.mockResolvedValue(null);
    render(<RefereePinSettings format="flex_tournament" parentId="p1" />);
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(screen.queryByLabelText('Mã PIN trọng tài')).toBeNull();
    expect(screen.getByText(/Người đã đăng nhập/)).toBeTruthy();
  });
});

describe('RefereePinSettings — actions', () => {
  it('enabling generates a fresh PIN, revealed', async () => {
    getMock.mockResolvedValue(null);
    setMock.mockResolvedValue('987654');
    render(<RefereePinSettings format="team_match" parentId="p1" />);
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(setMock).toHaveBeenCalledWith('team_match', 'p1'));
    expect((await screen.findByLabelText('Mã PIN trọng tài')).textContent).toContain('987 654');
  });

  it('disabling asks for confirmation then clears', async () => {
    getMock.mockResolvedValue({ pin: '111222', is_active: true });
    confirmMock.mockResolvedValue(true);
    clearMock.mockResolvedValue(undefined);
    render(<RefereePinSettings format="quick_table" parentId="p1" />);
    await screen.findByLabelText('Mã PIN trọng tài');
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    await waitFor(() => expect(clearMock).toHaveBeenCalledWith('quick_table', 'p1'));
  });

  it('disabling is a no-op when the confirm is dismissed', async () => {
    getMock.mockResolvedValue({ pin: '111222', is_active: true });
    confirmMock.mockResolvedValue(false);
    render(<RefereePinSettings format="quick_table" parentId="p1" />);
    await screen.findByLabelText('Mã PIN trọng tài');
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(clearMock).not.toHaveBeenCalled();
  });

  it('rotate confirms then sets a new PIN', async () => {
    getMock.mockResolvedValue({ pin: '111222', is_active: true });
    confirmMock.mockResolvedValue(true);
    setMock.mockResolvedValue('333444');
    render(<RefereePinSettings format="doubles_elimination" parentId="p1" />);
    await screen.findByLabelText('Mã PIN trọng tài');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã mới' }));
    await waitFor(() => expect(setMock).toHaveBeenCalledWith('doubles_elimination', 'p1'));
  });

  it('copies the PIN to the clipboard', async () => {
    getMock.mockResolvedValue({ pin: '555666', is_active: true });
    clipboardWrite.mockResolvedValue(undefined);
    render(<RefereePinSettings format="quick_table" parentId="p1" />);
    await screen.findByLabelText('Mã PIN trọng tài');
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép mã' }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('555666'));
    expect(toastSuccess).toHaveBeenCalledWith('Đã sao chép mã PIN.');
  });

  it('refuses to toggle while offline', async () => {
    getMock.mockResolvedValue(null);
    setOnline(false);
    render(<RefereePinSettings format="quick_table" parentId="p1" />);
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(setMock).not.toHaveBeenCalled();
  });

  it('surfaces a set failure as a toast', async () => {
    getMock.mockResolvedValue(null);
    setMock.mockRejectedValue(new Error('boom'));
    render(<RefereePinSettings format="quick_table" parentId="p1" />);
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Không thể cập nhật mã PIN.'));
  });
});
