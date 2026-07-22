// @vitest-environment jsdom
// Behaviour tests for the viewer-side PIN redeem entry. Covers the anonymous
// login redirect and every redeem outcome branch (ok / already / invalid /
// expired / rate_limited / offline / error).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import RefereeJoinByPin from '../RefereeJoinByPin';

const { redeemMock, navigateMock, toastSuccess, toastError, authState } = vi.hoisted(() => ({
  redeemMock: vi.fn(),
  navigateMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  authState: { user: null as null | { id: string } },
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

vi.mock('@/lib/referee-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/referee-helpers')>();
  return { ...actual, redeemRefereePin: (...a: unknown[]) => redeemMock(...a) };
});

vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ pathname: '/tools/quick-tables/abc123', search: '' }),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }));

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      common: { close: 'Đóng' },
      referee: {
        pin: {
          joinBtn: 'Nhập mã trọng tài',
          joinTitle: 'Vào chấm điểm',
          joinHelper: 'Nhập mã 6 số do ban tổ chức cung cấp.',
          joinSubmit: 'Bắt đầu chấm điểm',
          joinChecking: 'Đang kiểm tra…',
          codeLabel: 'Mã PIN trọng tài',
          errInvalid: 'Mã PIN không đúng.',
          errExpired: 'Giải đã kết thúc.',
          errRateLimited: 'Thử lại sau 15 phút.',
          errOffline: 'Đang ngoại tuyến.',
          errGeneric: 'Không thể xác nhận mã.',
          alreadyReferee: 'Bạn đã là trọng tài.',
          success: 'Đã thêm làm trọng tài.',
        },
      },
    },
  }),
}));

const setOnline = (v: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value: v, configurable: true });

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = null;
  setOnline(true);
});
afterEach(cleanup);

const openDialogAndType = async (pin: string) => {
  fireEvent.click(screen.getByRole('button', { name: /Nhập mã trọng tài/ }));
  const input = await screen.findByLabelText('Mã PIN trọng tài');
  fireEvent.change(input, { target: { value: pin } });
  return input;
};

describe('RefereeJoinByPin — anonymous', () => {
  it('routes to login with the current path preserved (no PIN in redirect)', () => {
    render(<RefereeJoinByPin format="quick_table" parentId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: /Nhập mã trọng tài/ }));
    expect(navigateMock).toHaveBeenCalledWith(
      '/login?redirect=' + encodeURIComponent('/tools/quick-tables/abc123')
    );
  });
});

describe('RefereeJoinByPin — logged in', () => {
  beforeEach(() => {
    authState.user = { id: 'u1' };
  });

  it('normalizes input and submits only a 6-digit code', async () => {
    redeemMock.mockResolvedValue('ok');
    const onJoined = vi.fn();
    render(<RefereeJoinByPin format="quick_table" parentId="p1" onJoined={onJoined} />);
    await openDialogAndType('123 456');
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu chấm điểm' }));
    await waitFor(() => expect(redeemMock).toHaveBeenCalledWith('quick_table', 'p1', '123456'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Đã thêm làm trọng tài.'));
    expect(onJoined).toHaveBeenCalled();
  });

  it('does not submit an incomplete PIN', async () => {
    render(<RefereeJoinByPin format="quick_table" parentId="p1" />);
    await openDialogAndType('123');
    const submit = screen.getByRole('button', { name: 'Bắt đầu chấm điểm' });
    expect(submit).toHaveProperty('disabled', true);
  });

  it.each([
    ['invalid', 'Mã PIN không đúng.'],
    ['expired', 'Giải đã kết thúc.'],
    ['rate_limited', 'Thử lại sau 15 phút.'],
  ])('shows the %s error inline', async (result, msg) => {
    redeemMock.mockResolvedValue(result);
    render(<RefereeJoinByPin format="quick_table" parentId="p1" />);
    await openDialogAndType('000000');
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu chấm điểm' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(msg);
  });

  it('treats already_referee as success and closes', async () => {
    redeemMock.mockResolvedValue('already_referee');
    const onJoined = vi.fn();
    render(<RefereeJoinByPin format="team_match" parentId="p1" onJoined={onJoined} />);
    await openDialogAndType('222333');
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu chấm điểm' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Bạn đã là trọng tài.'));
    expect(onJoined).toHaveBeenCalled();
  });

  it('blocks submit when offline without calling the server', async () => {
    setOnline(false);
    render(<RefereeJoinByPin format="quick_table" parentId="p1" />);
    await openDialogAndType('123456');
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu chấm điểm' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Đang ngoại tuyến.');
    expect(redeemMock).not.toHaveBeenCalled();
  });

  it('surfaces a thrown error as the generic message', async () => {
    redeemMock.mockRejectedValue(new Error('network'));
    render(<RefereeJoinByPin format="flex_tournament" parentId="p1" />);
    await openDialogAndType('654321');
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu chấm điểm' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Không thể xác nhận mã.');
  });
});
