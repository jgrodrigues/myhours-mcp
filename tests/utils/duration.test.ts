import { describe, it, expect } from 'vitest';
import {
  secondsToHours,
  hoursToSeconds,
  formatDuration,
  formatDecimalHours,
  parseDuration,
} from '../../src/utils/duration.js';

describe('secondsToHours', () => {
  it('converts seconds to hours', () => {
    expect(secondsToHours(3600)).toBe(1);
    expect(secondsToHours(5400)).toBe(1.5);
    expect(secondsToHours(0)).toBe(0);
  });

  it('handles fractional results', () => {
    expect(secondsToHours(60)).toBeCloseTo(0.01667, 4);
  });
});

describe('hoursToSeconds', () => {
  it('converts hours to seconds and rounds to nearest integer', () => {
    expect(hoursToSeconds(1)).toBe(3600);
    expect(hoursToSeconds(1.5)).toBe(5400);
    expect(hoursToSeconds(0)).toBe(0);
  });

  it('rounds half-hours and quarter-hours correctly', () => {
    expect(hoursToSeconds(2.5)).toBe(9000);
    expect(hoursToSeconds(0.25)).toBe(900);
  });

  it('rounds floating-point quirks (e.g. 0.1 + 0.2)', () => {
    expect(hoursToSeconds(0.1 + 0.2)).toBe(1080);
  });
});

describe('formatDuration', () => {
  it('formats whole hours', () => {
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(7200)).toBe('2h');
  });

  it('formats whole minutes when under an hour', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(900)).toBe('15m');
    expect(formatDuration(2700)).toBe('45m');
  });

  it('formats hours and minutes together', () => {
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(7500)).toBe('2h 5m');
  });

  it('formats zero seconds as "0m"', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('rounds seconds to the nearest minute (no Math.floor truncation bias)', () => {
    // 1h 49m 30s = 6570s — half-minute should round up to 1h 50m
    expect(formatDuration(6570)).toBe('1h 50m');
    // 1h 49m 29s = 6569s — should round down to 1h 49m
    expect(formatDuration(6569)).toBe('1h 49m');
    // 49.95min = 2997s — should round to 50m
    expect(formatDuration(2997)).toBe('50m');
  });

  it('handles minute boundary correctly when rounding pushes minutes to 60', () => {
    // 59m 40s = 3580s should NOT show as "0h 60m" — should show "1h"
    expect(formatDuration(3580)).toBe('1h');
    // 1h 59m 40s = 7180s should round to 2h
    expect(formatDuration(7180)).toBe('2h');
  });

  it('rounds sub-30-second durations to "0m" via Math.round', () => {
    expect(formatDuration(29)).toBe('0m');
    expect(formatDuration(30)).toBe('1m'); // 0.5 rounds up in JS Math.round
  });
});

describe('formatDecimalHours', () => {
  it('formats seconds as decimal hours with 1 decimal place', () => {
    expect(formatDecimalHours(3600)).toBe('1.0');
    expect(formatDecimalHours(5400)).toBe('1.5');
    expect(formatDecimalHours(0)).toBe('0.0');
  });

  it('rounds to 1 decimal place', () => {
    expect(formatDecimalHours(6597)).toBe('1.8');
    expect(formatDecimalHours(6601)).toBe('1.8');
  });

  it('handles long durations', () => {
    expect(formatDecimalHours(36000)).toBe('10.0');
  });
});

describe('parseDuration', () => {
  it('parses decimal hours formats', () => {
    expect(parseDuration('2.5h')).toBe(9000);
    expect(parseDuration('2.5')).toBe(9000);
    expect(parseDuration('1h')).toBe(3600);
    expect(parseDuration('0.25h')).toBe(900);
  });

  it('parses hours-and-minutes formats', () => {
    expect(parseDuration('2h 30m')).toBe(9000);
    expect(parseDuration('2h30m')).toBe(9000);
    expect(parseDuration('1h 0m')).toBe(3600);
  });

  it('parses minutes-only format', () => {
    expect(parseDuration('30m')).toBe(1800);
    expect(parseDuration('45m')).toBe(2700);
  });

  it('returns null on invalid input', () => {
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('2x')).toBeNull();
    expect(parseDuration('h')).toBeNull();
  });

  it('is case-insensitive on H and M', () => {
    expect(parseDuration('2H 30M')).toBe(9000);
    expect(parseDuration('30M')).toBe(1800);
  });
});

describe('round-trip property', () => {
  it('hoursToSeconds and secondsToHours are inverse for whole-second durations', () => {
    for (const hours of [0, 0.5, 1, 1.5, 2.5, 8, 24]) {
      expect(secondsToHours(hoursToSeconds(hours))).toBeCloseTo(hours, 6);
    }
  });
});
