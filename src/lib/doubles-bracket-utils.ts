import type { BestOfFormat, RoundType } from '@/hooks/useDoublesElimination';

export function nextPowerOf2(n: number): number {
  let power = 1;
  while (power < n) power *= 2;
  return power;
}

export function getBestOfForRound(
  roundType: RoundType,
  earlyFormat: BestOfFormat,
  semifinalsFormat: BestOfFormat,
  finalsFormat: BestOfFormat
): number {
  if (roundType === 'final' || roundType === 'third_place') {
    return finalsFormat === 'bo5' ? 5 : finalsFormat === 'bo3' ? 3 : 1;
  }

  if (roundType === 'semifinal') {
    return semifinalsFormat === 'bo5' ? 5 : semifinalsFormat === 'bo3' ? 3 : 1;
  }

  switch (earlyFormat) {
    case 'bo5': return 5;
    case 'bo3': return 3;
    default: return 1;
  }
}

export function generateSeedPositions(bracketSize: number): number[] {
  if (bracketSize === 2) return [0, 1];
  if (bracketSize === 4) return [0, 3, 2, 1];
  if (bracketSize === 8) return [0, 7, 4, 3, 2, 5, 6, 1];
  if (bracketSize === 16) return [0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1];
  if (bracketSize === 32) return [
    0, 31, 16, 15, 8, 23, 24, 7,
    4, 27, 20, 11, 12, 19, 28, 3,
    2, 29, 18, 13, 10, 21, 26, 5,
    6, 25, 22, 9, 14, 17, 30, 1
  ];
  // Recursive fallback for larger brackets
  const halfPositions = generateSeedPositions(bracketSize / 2);
  const positions: number[] = [];
  for (let i = 0; i < halfPositions.length; i++) {
    positions.push(halfPositions[i] * 2);
    positions.push(bracketSize - 1 - halfPositions[i] * 2);
  }
  return positions;
}

export function generateShareId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function assignCourtAndTime(
  courtNextSlot: Map<number, number>,
  courts: number[],
  startHour: number,
  startMinute: number,
  matchDurationMinutes: number
): { courtNumber: number; startTime: string } {
  const minSlot = Math.min(...Array.from(courtNextSlot.values()));
  const availableCourt = courts.find(c => courtNextSlot.get(c) === minSlot) || courts[0];
  const slotIdx = courtNextSlot.get(availableCourt) || 0;
  const totalMinutes = startHour * 60 + startMinute + slotIdx * matchDurationMinutes;
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  courtNextSlot.set(availableCourt, slotIdx + 1);

  return { courtNumber: availableCourt, startTime };
}
