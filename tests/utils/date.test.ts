import { describe, it, expect } from 'vitest';
import {
  formatDate,
  parseDate,
  getWeekStart,
  getWeekEnd,
  getDateRange,
  isValidDateString,
  addDays,
} from '../../src/utils/date.js';

describe('formatDate', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 0, 15))).toBe('2026-01-15');
    expect(formatDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('zero-pads single-digit months and days', () => {
    expect(formatDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(formatDate(new Date(2026, 8, 9))).toBe('2026-09-09');
  });
});

describe('parseDate', () => {
  it('parses a YYYY-MM-DD string into a Date', () => {
    const d = parseDate('2026-04-28');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April is month index 3
    expect(d.getDate()).toBe(28);
  });

  it('round-trips with formatDate', () => {
    const dates = ['2025-12-31', '2026-01-01', '2026-02-28', '2026-04-28'];
    for (const s of dates) {
      expect(formatDate(parseDate(s))).toBe(s);
    }
  });
});

describe('isValidDateString', () => {
  it('accepts valid YYYY-MM-DD strings', () => {
    expect(isValidDateString('2026-04-28')).toBe(true);
    expect(isValidDateString('2025-12-31')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true); // 2024 is a leap year
  });

  it('rejects malformed strings', () => {
    expect(isValidDateString('2026-4-28')).toBe(false); // missing zero-pad
    expect(isValidDateString('28-04-2026')).toBe(false); // wrong order
    expect(isValidDateString('2026/04/28')).toBe(false); // wrong separator
    expect(isValidDateString('not a date')).toBe(false);
    expect(isValidDateString('')).toBe(false);
  });
});

describe('getWeekStart', () => {
  it('returns the Monday for a midweek date', () => {
    // 2026-04-28 is a Tuesday → Monday is 2026-04-27
    expect(getWeekStart(new Date(2026, 3, 28))).toBe('2026-04-27');
  });

  it('returns the same date when given a Monday', () => {
    // 2026-04-27 is a Monday
    expect(getWeekStart(new Date(2026, 3, 27))).toBe('2026-04-27');
  });

  it('returns the previous Monday when given a Sunday', () => {
    // 2026-04-26 is a Sunday → its week starts Monday 2026-04-20
    expect(getWeekStart(new Date(2026, 3, 26))).toBe('2026-04-20');
  });
});

describe('getWeekEnd', () => {
  it('returns the Sunday for a midweek date', () => {
    // 2026-04-28 (Tue) → Sunday 2026-05-03
    expect(getWeekEnd(new Date(2026, 3, 28))).toBe('2026-05-03');
  });

  it('returns same date when given a Sunday', () => {
    // 2026-04-26 is a Sunday
    expect(getWeekEnd(new Date(2026, 3, 26))).toBe('2026-04-26');
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays('2026-04-28', 1)).toBe('2026-04-29');
    expect(addDays('2026-04-28', 7)).toBe('2026-05-05');
  });

  it('adds zero days (no change)', () => {
    expect(addDays('2026-04-28', 0)).toBe('2026-04-28');
  });

  it('subtracts (negative days)', () => {
    expect(addDays('2026-04-28', -1)).toBe('2026-04-27');
    expect(addDays('2026-04-01', -1)).toBe('2026-03-31');
  });

  it('handles month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01'); // 2026 not a leap year
  });

  it('handles year boundaries', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles leap year February correctly', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
  });
});

describe('getDateRange', () => {
  it('returns a single date when start equals end', () => {
    expect(getDateRange('2026-04-28', '2026-04-28')).toEqual(['2026-04-28']);
  });

  it('returns inclusive range', () => {
    expect(getDateRange('2026-04-26', '2026-04-28')).toEqual([
      '2026-04-26',
      '2026-04-27',
      '2026-04-28',
    ]);
  });

  it('handles month boundaries', () => {
    expect(getDateRange('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('returns empty array when end is before start', () => {
    expect(getDateRange('2026-04-28', '2026-04-26')).toEqual([]);
  });

  it('produces 7 entries for a full week', () => {
    expect(getDateRange('2026-04-27', '2026-05-03')).toHaveLength(7);
  });
});
