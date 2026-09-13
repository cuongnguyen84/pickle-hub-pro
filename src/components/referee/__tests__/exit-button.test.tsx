// @vitest-environment jsdom
// Hành vi của màn chấm điểm trọng tài. Trọng tâm là đường thoát: khi đã vào
// bảng điểm, nút thoát nằm ở thanh hành động dưới (cạnh HOÀN TÁC / KẾT THÚC)
// chứ không còn trên header — header bị xoay ra mép màn hình khi điện thoại
// cầm dọc nên trọng tài không tìm thấy nó. Các ca còn lại phủ vòng đời một
// trận: bắt đầu, ghi điểm, hoàn tác, timeout, ghi chú, kết thúc.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RefereeScoringScreen, type RefereeLoaded } from '../RefereeScoringScreen';
import { startState, type RefereeLiveState, type ScoringMode } from '@/lib/refereeScoring';

const loaded: RefereeLoaded = {
  matchId: 'm1',
  teamAName: 'Đội A',
  teamBName: 'Đội B',
  playersA: null,
  playersB: null,
  isDoubles: false,
  backHref: '/tools/quick-tables/t1',
};

const PERSIST = 'test-ref:m1';

type Props = Partial<React.ComponentProps<typeof RefereeScoringScreen>>;

function renderScreen(props: Props = {}) {
  return render(
    <MemoryRouter>
      <RefereeScoringScreen
        loaded={loaded}
        vi
        persistKey={PERSIST}
        onFinish={async () => {}}
        {...props}
      />
    </MemoryRouter>,
  );
}

/** Bày sẵn một ván đang dở trong localStorage để vào thẳng bảng điểm. */
function resume(mode: ScoringMode = 'rally', extra: Record<string, unknown> = {}) {
  localStorage.setItem(
    PERSIST,
    JSON.stringify({ ...startState({ mode, isSingles: false, winTarget: 11 }), ...extra }),
  );
}

const bottomBar = () => screen.getByText('HOÀN TÁC').closest('div')!.parentElement!;

describe('RefereeScoringScreen', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('màn cài đặt: nút quay lại nằm trên header, chưa có nút thoát dưới', () => {
    const onBack = vi.fn();
    renderScreen({ onBack });
    expect(screen.queryByLabelText('Thoát khỏi màn chấm điểm')).toBeNull();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('bảng điểm: nút thoát nằm cùng hàng HOÀN TÁC / KẾT THÚC, không ở header', () => {
    resume();
    const onBack = vi.fn();
    renderScreen({ onBack });

    expect(screen.getAllByText('CHẠM = +1')).toHaveLength(2);
    const exit = screen.getByLabelText('Thoát khỏi màn chấm điểm');
    const bar = exit.parentElement!;
    expect(bar.textContent).toContain('HOÀN TÁC');
    expect(bar.textContent).toContain('KẾT THÚC');
    expect(exit.closest('header')).toBeNull();

    fireEvent.click(exit);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('bắt đầu trận: chọn đội giao rồi BẮT ĐẦU thì claim live rồi mới ghi điểm', async () => {
    const onClaimLive = vi.fn(() => true);
    const onLiveScore = vi.fn();
    renderScreen({ onClaimLive, onLiveScore });

    fireEvent.click(screen.getByText('Đội A'));
    fireEvent.click(screen.getByText('BẮT ĐẦU'));

    expect(await screen.findByText('KẾT THÚC')).toBeTruthy();
    expect(onClaimLive).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByText('CHẠM = +1')[1]);
    expect(onLiveScore).toHaveBeenLastCalledWith(0, 1);
  });

  it('mất quyền chấm khi bắt đầu thì màn hình khoá lại', async () => {
    renderScreen({ onClaimLive: () => false });
    fireEvent.click(screen.getByText('Đội A'));
    fireEvent.click(screen.getByText('BẮT ĐẦU'));
    expect(await screen.findByText('Trọng tài khác đang chấm')).toBeTruthy();
  });

  it('ghi điểm rồi hoàn tác: điểm và trạng thái lưu quay về đúng mốc trước', () => {
    resume();
    const onLiveScore = vi.fn();
    renderScreen({ onLiveScore });

    fireEvent.click(screen.getAllByText('CHẠM = +1')[0]);
    expect(onLiveScore).toHaveBeenLastCalledWith(1, 0);
    expect(JSON.parse(localStorage.getItem(PERSIST)!).a).toBe(1);

    fireEvent.click(screen.getByText('HOÀN TÁC'));
    expect(onLiveScore).toHaveBeenLastCalledWith(0, 0);
    expect(JSON.parse(localStorage.getItem(PERSIST)!).a).toBe(0);
  });

  it('kết thúc trận: xác nhận thì lưu tỉ số, xoá trạng thái tạm và dọn dòng live', async () => {
    resume();
    const onFinish = vi.fn(async (_a: number, _b: number, _note: string | null) => {});
    const onLiveState = vi.fn();
    renderScreen({ onFinish, onLiveState });

    fireEvent.click(screen.getAllByText('CHẠM = +1')[0]);
    fireEvent.click(screen.getByText('KẾT THÚC'));
    expect(screen.getByText('Đội A THẮNG')).toBeTruthy();

    fireEvent.click(screen.getByText('Xác nhận'));
    await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());
    expect(onFinish.mock.calls[0].slice(0, 2)).toEqual([1, 0]);
    expect(localStorage.getItem(PERSIST)).toBeNull();
    expect(onLiveState).toHaveBeenLastCalledWith(null);
  });

  it('tỉ số hoà thì không cho xác nhận', () => {
    resume();
    renderScreen();
    fireEvent.click(screen.getByText('KẾT THÚC'));
    expect(screen.getByText('Tỉ số hoà — chưa có đội thắng.')).toBeTruthy();
    expect(screen.getByText('Xác nhận').closest('button')!.disabled).toBe(true);
  });

  it('timeout: bấm là hiện đồng hồ, đóng lại thì trừ vào quỹ của đội', () => {
    resume();
    renderScreen();

    const before = screen.getAllByText(/^TO 2$/);
    expect(before.length).toBeGreaterThan(0);
    fireEvent.click(before[0].closest('button')!);
    expect(screen.getByText(/TIMEOUT · Đội A/)).toBeTruthy();

    fireEvent.click(screen.getByText('Tiếp tục'));
    expect(screen.getAllByText(/^TO 1$/).length).toBeGreaterThan(0);
  });

  it('ghi chú hai bên được giữ lại và đi kèm khi kết thúc', async () => {
    resume();
    const onFinish = vi.fn(async (_a: number, _b: number, _note: string | null) => {});
    renderScreen({ onFinish });

    fireEvent.click(screen.getByText('Ghi chú'));
    const boxes = screen.getAllByPlaceholderText('Sự cố, hội ý, khiếu nại…');
    fireEvent.change(boxes[0], { target: { value: 'đổi vợt' } });
    fireEvent.click(screen.getByText('Xong'));

    fireEvent.click(screen.getAllByText('CHẠM = +1')[0]);
    fireEvent.click(screen.getByText('KẾT THÚC'));
    fireEvent.click(screen.getByText('Xác nhận'));
    await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());
    expect(onFinish.mock.calls[0][2]).toContain('đổi vợt');
  });

  it('nhắc đổi sân khi tới mốc giữa trận', () => {
    resume('rally', { a: 5, b: 0 });
    renderScreen();
    fireEvent.click(screen.getAllByText('CHẠM = +1')[0]);
    expect(screen.getByText('ĐỔI SÂN')).toBeTruthy();
    fireEvent.click(screen.getByText('Đã đổi sân'));
    expect(screen.queryByText('ĐỔI SÂN')).toBeNull();
  });

  it('thể thức giao bóng: hai vùng là ĐIỂM và ĐỔI GIAO', () => {
    resume('sideOut');
    renderScreen();
    expect(screen.getByText('ĐIỂM')).toBeTruthy();
    expect(screen.getByText('ĐỔI GIAO')).toBeTruthy();
    fireEvent.click(screen.getByText('ĐIỂM'));
    expect(JSON.parse(localStorage.getItem(PERSIST)!).a).toBe(1);
  });

  it('bảng điểm tay: cộng trừ điểm trực tiếp', () => {
    resume('manual');
    renderScreen();
    const plus = screen.getAllByText('+1')[0];
    fireEvent.click(plus);
    expect(JSON.parse(localStorage.getItem(PERSIST)!).a).toBe(1);
    fireEvent.click(screen.getAllByText('−1')[0]);
    expect(JSON.parse(localStorage.getItem(PERSIST)!).a).toBe(0);
  });

  it('người xem (readOnly) chỉ theo dõi, không ghi và không có nút kết thúc', () => {
    const onLiveState = vi.fn();
    const env: RefereeLiveState = {
      v: 1,
      state: { ...startState({ mode: 'rally', isSingles: false, winTarget: 11 }), a: 3, b: 2 },
      history: [],
      usedReg: { a: 0, b: 0 },
      usedMed: { a: 0, b: 0 },
      regularTO: 2,
      notes: { a: '', b: '' },
    };
    renderScreen({ readOnly: true, liveState: env, onLiveState });

    expect(screen.getByText('Trọng tài khác đang chấm')).toBeTruthy();
    fireEvent.click(screen.getByText('KẾT THÚC'));
    expect(screen.queryByText('Xác nhận')).toBeNull();
    expect(onLiveState).not.toHaveBeenCalled();
    expect(within(bottomBar()).getByLabelText('Thoát khỏi màn chấm điểm')).toBeTruthy();
  });

  it('dòng trận thắng localStorage khi khôi phục', () => {
    resume('rally', { a: 9, b: 9 });
    const env: RefereeLiveState = {
      v: 1,
      state: { ...startState({ mode: 'rally', isSingles: false, winTarget: 11 }), a: 2, b: 1 },
      history: [],
      usedReg: { a: 1, b: 0 },
      usedMed: { a: 0, b: 0 },
      regularTO: 2,
      notes: { a: '', b: '' },
    };
    renderScreen({ initialLiveState: env });
    expect(screen.getByText('2-1')).toBeTruthy();
  });
});
