// @vitest-environment jsdom
// Ghim đường thoát của màn chấm điểm: khi đã vào bảng điểm, nút thoát nằm ở
// thanh hành động dưới (cạnh HOÀN TÁC / KẾT THÚC) chứ không còn trên header —
// header bị xoay ra mép màn hình khi điện thoại cầm dọc, trọng tài không thấy.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RefereeScoringScreen, type RefereeLoaded } from '../RefereeScoringScreen';
import { startState } from '@/lib/refereeScoring';

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

function renderScreen(onBack?: () => void) {
  return render(
    <MemoryRouter>
      <RefereeScoringScreen
        loaded={loaded}
        vi
        persistKey={PERSIST}
        onFinish={async () => {}}
        onBack={onBack}
      />
    </MemoryRouter>,
  );
}

describe('RefereeScoringScreen — đường thoát', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('màn cài đặt: nút quay lại nằm trên header', () => {
    const onBack = vi.fn();
    renderScreen(onBack);
    expect(screen.queryByLabelText('Thoát khỏi màn chấm điểm')).toBeNull();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('bảng điểm: nút thoát nằm ở thanh dưới và thoát được', () => {
    localStorage.setItem(
      PERSIST,
      JSON.stringify(startState({ mode: 'rally', isSingles: false, winTarget: 11 })),
    );
    const onBack = vi.fn();
    renderScreen(onBack);

    // bảng điểm đã hiện (2 vùng chạm ghi điểm)
    expect(screen.getAllByText('CHẠM = +1')).toHaveLength(2);

    const exit = screen.getByLabelText('Thoát khỏi màn chấm điểm');
    // cùng hàng với HOÀN TÁC / KẾT THÚC, không nằm trong header
    const bar = exit.parentElement!;
    expect(bar.textContent).toContain('HOÀN TÁC');
    expect(bar.textContent).toContain('KẾT THÚC');
    expect(exit.closest('header')).toBeNull();

    fireEvent.click(exit);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
