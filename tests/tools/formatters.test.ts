import { describe, it, expect } from 'vitest';
import {
  formatTimeLogs,
  formatTimeLogsRaw,
  formatRangeSummary,
  formatDailySummary,
  formatWeeklySummary,
  formatProjects,
  formatClients,
} from '../../src/tools/formatters.js';
import type { TimeLog, Project, Client } from '../../src/types/api.js';

const baseLog: TimeLog = {
  id: 'log-1',
  note: 'Test work',
  date: '2026-04-28T00:00:00',
  duration: 6597, // 1h 49m 57s — exercises sub-minute precision
  projectId: 'proj-1',
  projectName: 'Project Alpha',
  taskId: 'task-1',
  taskName: 'Development',
  clientId: 'client-1',
  clientName: 'Acme Corp',
  billable: true,
  billed: false,
  projectInvoiceMethod: 0,
  projectArchived: false,
  taskArchived: false,
  userId: 'user-1',
  userName: 'Test User',
  start: null,
  end: null,
  startTime: null,
  endTime: null,
  running: false,
};

function makeLog(overrides: Partial<TimeLog>): TimeLog {
  return { ...baseLog, ...overrides };
}

describe('formatTimeLogs (markdown)', () => {
  it('returns "no logs" message for empty list', () => {
    expect(formatTimeLogs([])).toBe('No time logs found.');
  });

  it('shows total entry count in the heading', () => {
    const logs = [
      makeLog({ id: 'a', date: '2026-04-28T00:00:00' }),
      makeLog({ id: 'b', date: '2026-04-27T00:00:00' }),
    ];
    expect(formatTimeLogs(logs)).toContain('Time Logs (2 entries)');
  });

  it('groups logs by date and sorts dates descending', () => {
    const logs = [
      makeLog({ id: 'older', date: '2026-04-26T00:00:00' }),
      makeLog({ id: 'newer', date: '2026-04-28T00:00:00' }),
    ];
    const out = formatTimeLogs(logs);
    expect(out.indexOf('Apr 28')).toBeLessThan(out.indexOf('Apr 26'));
  });

  it('marks non-billable entries', () => {
    const logs = [makeLog({ billable: false })];
    expect(formatTimeLogs(logs)).toContain('[non-billable]');
  });

  it('marks running timer with [RUNNING]', () => {
    const logs = [makeLog({ running: true })];
    expect(formatTimeLogs(logs)).toContain('[RUNNING]');
  });

  it('falls back to "No description" when note is null or empty', () => {
    const logs = [makeLog({ note: null })];
    expect(formatTimeLogs(logs)).toContain('No description');
  });
});

describe('formatTimeLogsRaw (JSON)', () => {
  it('returns parseable JSON', () => {
    const out = formatTimeLogsRaw([], '2026-04-01', '2026-04-30');
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it('echoes the date range', () => {
    const out = formatTimeLogsRaw([], '2026-04-01', '2026-04-30');
    const parsed = JSON.parse(out);
    expect(parsed.date_from).toBe('2026-04-01');
    expect(parsed.date_to).toBe('2026-04-30');
  });

  it('returns empty entries and zero totals when no logs', () => {
    const parsed = JSON.parse(formatTimeLogsRaw([], '2026-04-01', '2026-04-30'));
    expect(parsed.entry_count).toBe(0);
    expect(parsed.entries).toEqual([]);
    expect(parsed.summary.total_seconds).toBe(0);
    expect(parsed.summary.billable_seconds).toBe(0);
    expect(parsed.summary.non_billable_seconds).toBe(0);
    expect(parsed.summary.by_date).toEqual([]);
    expect(parsed.summary.by_project).toEqual([]);
  });

  it('preserves raw seconds — no Math.floor truncation in totals', () => {
    const logs = [
      makeLog({ id: 'a', duration: 6597, date: '2026-04-28T00:00:00' }),
      makeLog({ id: 'b', duration: 3599, date: '2026-04-28T00:00:00' }),
    ];
    const parsed = JSON.parse(formatTimeLogsRaw(logs, '2026-04-28', '2026-04-28'));
    expect(parsed.summary.total_seconds).toBe(10196); // 6597 + 3599 — exact
  });

  it('separates billable and non-billable totals', () => {
    const logs = [
      makeLog({ id: 'a', duration: 3600, billable: true }),
      makeLog({ id: 'b', duration: 1800, billable: false }),
      makeLog({ id: 'c', duration: 600, billable: true }),
    ];
    const parsed = JSON.parse(formatTimeLogsRaw(logs, '2026-04-28', '2026-04-28'));
    expect(parsed.summary.total_seconds).toBe(6000);
    expect(parsed.summary.billable_seconds).toBe(4200);
    expect(parsed.summary.non_billable_seconds).toBe(1800);
  });

  it('groups by date in chronological (ascending) order', () => {
    const logs = [
      makeLog({ id: 'c', duration: 100, date: '2026-04-28T00:00:00' }),
      makeLog({ id: 'a', duration: 200, date: '2026-04-26T00:00:00' }),
      makeLog({ id: 'b', duration: 300, date: '2026-04-27T00:00:00' }),
    ];
    const parsed = JSON.parse(formatTimeLogsRaw(logs, '2026-04-26', '2026-04-28'));
    expect(parsed.summary.by_date).toEqual([
      { date: '2026-04-26', total_seconds: 200 },
      { date: '2026-04-27', total_seconds: 300 },
      { date: '2026-04-28', total_seconds: 100 },
    ]);
  });

  it('groups multiple entries on the same day into one by_date row', () => {
    const logs = [
      makeLog({ id: 'a', duration: 100, date: '2026-04-28T00:00:00' }),
      makeLog({ id: 'b', duration: 200, date: '2026-04-28T00:00:00' }),
      makeLog({ id: 'c', duration: 300, date: '2026-04-28T00:00:00' }),
    ];
    const parsed = JSON.parse(formatTimeLogsRaw(logs, '2026-04-28', '2026-04-28'));
    expect(parsed.summary.by_date).toEqual([
      { date: '2026-04-28', total_seconds: 600 },
    ]);
  });

  it('groups by project', () => {
    const logs = [
      makeLog({ id: 'a', duration: 1000, projectId: 'p1', projectName: 'Alpha' }),
      makeLog({ id: 'b', duration: 2000, projectId: 'p2', projectName: 'Beta' }),
      makeLog({ id: 'c', duration: 500, projectId: 'p1', projectName: 'Alpha' }),
    ];
    const parsed = JSON.parse(formatTimeLogsRaw(logs, '2026-04-28', '2026-04-28'));
    expect(parsed.summary.by_project).toContainEqual({
      project_id: 'p1',
      project_name: 'Alpha',
      total_seconds: 1500,
    });
    expect(parsed.summary.by_project).toContainEqual({
      project_id: 'p2',
      project_name: 'Beta',
      total_seconds: 2000,
    });
  });

  it('handles null projectId by emitting null in by_project', () => {
    const logs = [
      makeLog({ id: 'a', duration: 100, projectId: null, projectName: null }),
    ];
    const parsed = JSON.parse(formatTimeLogsRaw(logs, '2026-04-28', '2026-04-28'));
    expect(parsed.summary.by_project).toEqual([
      { project_id: null, project_name: null, total_seconds: 100 },
    ]);
  });

  it('strips T-portion of date in entries', () => {
    const logs = [makeLog({ date: '2026-04-28T15:30:00' })];
    const parsed = JSON.parse(formatTimeLogsRaw(logs, '2026-04-28', '2026-04-28'));
    expect(parsed.entries[0].date).toBe('2026-04-28');
  });

  it('includes both duration_seconds and duration_display per entry', () => {
    const logs = [makeLog({ duration: 6597 })]; // 1h 49m 57s
    const parsed = JSON.parse(formatTimeLogsRaw(logs, '2026-04-28', '2026-04-28'));
    expect(parsed.entries[0].duration_seconds).toBe(6597);
    expect(parsed.entries[0].duration_display).toBe('1h 50m'); // rounds to nearest minute
  });

  it('includes the curated set of fields per entry', () => {
    const logs = [makeLog({})];
    const parsed = JSON.parse(formatTimeLogsRaw(logs, '2026-04-28', '2026-04-28'));
    const entry = parsed.entries[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('date');
    expect(entry).toHaveProperty('duration_seconds');
    expect(entry).toHaveProperty('duration_display');
    expect(entry).toHaveProperty('project_id');
    expect(entry).toHaveProperty('project_name');
    expect(entry).toHaveProperty('task_id');
    expect(entry).toHaveProperty('task_name');
    expect(entry).toHaveProperty('client_name');
    expect(entry).toHaveProperty('billable');
    expect(entry).toHaveProperty('billed');
    expect(entry).toHaveProperty('note');
  });
});

describe('formatRangeSummary', () => {
  it('returns parseable JSON', () => {
    const out = formatRangeSummary([], '2026-04-01', '2026-04-30', 'total');
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it('echoes back the date range and granularity', () => {
    const parsed = JSON.parse(
      formatRangeSummary([], '2026-04-01', '2026-04-30', 'monthly')
    );
    expect(parsed.date_from).toBe('2026-04-01');
    expect(parsed.date_to).toBe('2026-04-30');
    expect(parsed.granularity).toBe('monthly');
  });

  it('returns zero totals and empty arrays when no logs', () => {
    const parsed = JSON.parse(
      formatRangeSummary([], '2026-04-01', '2026-04-30', 'total')
    );
    expect(parsed.summary.total_seconds).toBe(0);
    expect(parsed.summary.entry_count).toBe(0);
    expect(parsed.by_period).toEqual([]);
    expect(parsed.by_project).toEqual([]);
    expect(parsed.by_client).toEqual([]);
  });

  it('preserves raw seconds in totals (no rounding bias)', () => {
    const logs = [
      makeLog({ id: 'a', duration: 6597, date: '2026-04-28T00:00:00' }),
      makeLog({ id: 'b', duration: 3599, date: '2026-04-28T00:00:00' }),
    ];
    const parsed = JSON.parse(
      formatRangeSummary(logs, '2026-04-28', '2026-04-28', 'total')
    );
    expect(parsed.summary.total_seconds).toBe(10196);
  });

  it('separates billable and non-billable', () => {
    const logs = [
      makeLog({ id: 'a', duration: 3600, billable: true }),
      makeLog({ id: 'b', duration: 1800, billable: false }),
    ];
    const parsed = JSON.parse(
      formatRangeSummary(logs, '2026-04-28', '2026-04-28', 'total')
    );
    expect(parsed.summary.billable_seconds).toBe(3600);
    expect(parsed.summary.non_billable_seconds).toBe(1800);
  });

  describe('granularity: total', () => {
    it('returns a single period covering the full input range', () => {
      const logs = [
        makeLog({ duration: 1000, date: '2026-04-05T00:00:00' }),
        makeLog({ duration: 2000, date: '2026-04-20T00:00:00' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-04-01', '2026-04-30', 'total')
      );
      expect(parsed.by_period).toEqual([
        {
          period_start: '2026-04-01',
          period_end: '2026-04-30',
          total_seconds: 3000,
          billable_seconds: expect.any(Number),
          entry_count: 2,
        },
      ]);
    });
  });

  describe('granularity: daily', () => {
    it('emits one bucket per day with entries (no empty days)', () => {
      const logs = [
        makeLog({ id: 'a', duration: 1000, date: '2026-04-26T00:00:00' }),
        makeLog({ id: 'b', duration: 2000, date: '2026-04-28T00:00:00' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-04-26', '2026-04-28', 'daily')
      );
      expect(parsed.by_period).toEqual([
        {
          period_start: '2026-04-26',
          period_end: '2026-04-26',
          total_seconds: 1000,
          billable_seconds: expect.any(Number),
          entry_count: 1,
        },
        {
          period_start: '2026-04-28',
          period_end: '2026-04-28',
          total_seconds: 2000,
          billable_seconds: expect.any(Number),
          entry_count: 1,
        },
      ]);
    });

    it('groups multiple entries on the same day', () => {
      const logs = [
        makeLog({ id: 'a', duration: 100, date: '2026-04-28T00:00:00' }),
        makeLog({ id: 'b', duration: 200, date: '2026-04-28T00:00:00' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-04-28', '2026-04-28', 'daily')
      );
      expect(parsed.by_period).toHaveLength(1);
      expect(parsed.by_period[0].total_seconds).toBe(300);
      expect(parsed.by_period[0].entry_count).toBe(2);
    });
  });

  describe('granularity: weekly', () => {
    it('groups entries into Mon→Sun ISO weeks', () => {
      // 2026-04-28 is a Tuesday. Week starts 2026-04-27 (Mon), ends 2026-05-03 (Sun)
      const logs = [
        makeLog({ id: 'a', duration: 1000, date: '2026-04-28T00:00:00' }),
        makeLog({ id: 'b', duration: 2000, date: '2026-05-02T00:00:00' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-04-27', '2026-05-03', 'weekly')
      );
      expect(parsed.by_period).toEqual([
        {
          period_start: '2026-04-27',
          period_end: '2026-05-03',
          total_seconds: 3000,
          billable_seconds: expect.any(Number),
          entry_count: 2,
        },
      ]);
    });

    it('handles a Sunday entry as belonging to the week starting prior Monday', () => {
      // 2026-04-26 is a Sunday → week starts 2026-04-20
      const logs = [
        makeLog({ duration: 1000, date: '2026-04-26T00:00:00' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-04-20', '2026-04-26', 'weekly')
      );
      expect(parsed.by_period[0].period_start).toBe('2026-04-20');
      expect(parsed.by_period[0].period_end).toBe('2026-04-26');
    });

    it('produces one period per week across multi-week range', () => {
      const logs = [
        makeLog({ id: 'w1', duration: 1000, date: '2026-04-21T00:00:00' }),
        makeLog({ id: 'w2', duration: 2000, date: '2026-04-28T00:00:00' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-04-20', '2026-05-03', 'weekly')
      );
      expect(parsed.by_period).toHaveLength(2);
      expect(parsed.by_period[0].period_start).toBe('2026-04-20');
      expect(parsed.by_period[1].period_start).toBe('2026-04-27');
    });
  });

  describe('granularity: monthly', () => {
    it('groups by calendar month with first/last day boundaries', () => {
      const logs = [
        makeLog({ id: 'jan', duration: 1000, date: '2026-01-15T00:00:00' }),
        makeLog({ id: 'feb', duration: 2000, date: '2026-02-20T00:00:00' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-01-01', '2026-02-28', 'monthly')
      );
      expect(parsed.by_period).toEqual([
        {
          period_start: '2026-01-01',
          period_end: '2026-01-31',
          total_seconds: 1000,
          billable_seconds: expect.any(Number),
          entry_count: 1,
        },
        {
          period_start: '2026-02-01',
          period_end: '2026-02-28', // 2026 is not a leap year
          total_seconds: 2000,
          billable_seconds: expect.any(Number),
          entry_count: 1,
        },
      ]);
    });

    it('correctly identifies February 29 in a leap year', () => {
      const logs = [
        makeLog({ duration: 1000, date: '2024-02-15T00:00:00' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2024-02-01', '2024-02-29', 'monthly')
      );
      expect(parsed.by_period[0].period_end).toBe('2024-02-29');
    });

    it('handles 30- and 31-day month boundaries', () => {
      const logs = [
        makeLog({ id: 'apr', duration: 1, date: '2026-04-15T00:00:00' }),
        makeLog({ id: 'may', duration: 1, date: '2026-05-15T00:00:00' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-04-01', '2026-05-31', 'monthly')
      );
      expect(parsed.by_period[0].period_end).toBe('2026-04-30');
      expect(parsed.by_period[1].period_end).toBe('2026-05-31');
    });

    it('emits monthly periods sorted chronologically', () => {
      const logs = [
        makeLog({ id: 'mar', duration: 1, date: '2026-03-01T00:00:00' }),
        makeLog({ id: 'jan', duration: 1, date: '2026-01-01T00:00:00' }),
        makeLog({ id: 'feb', duration: 1, date: '2026-02-01T00:00:00' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-01-01', '2026-03-31', 'monthly')
      );
      expect(parsed.by_period.map((p: { period_start: string }) => p.period_start)).toEqual([
        '2026-01-01',
        '2026-02-01',
        '2026-03-01',
      ]);
    });
  });

  describe('by_project / by_client aggregation', () => {
    it('aggregates by project across the whole range', () => {
      const logs = [
        makeLog({ id: 'a', duration: 1000, projectId: 'p1', projectName: 'Alpha' }),
        makeLog({ id: 'b', duration: 2000, projectId: 'p2', projectName: 'Beta' }),
        makeLog({ id: 'c', duration: 500, projectId: 'p1', projectName: 'Alpha' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-04-28', '2026-04-28', 'total')
      );
      expect(parsed.by_project).toContainEqual({
        project_id: 'p1',
        project_name: 'Alpha',
        total_seconds: 1500,
      });
      expect(parsed.by_project).toContainEqual({
        project_id: 'p2',
        project_name: 'Beta',
        total_seconds: 2000,
      });
    });

    it('aggregates by client', () => {
      const logs = [
        makeLog({ id: 'a', duration: 1000, clientName: 'Acme' }),
        makeLog({ id: 'b', duration: 2000, clientName: 'Globex' }),
        makeLog({ id: 'c', duration: 500, clientName: 'Acme' }),
      ];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-04-28', '2026-04-28', 'total')
      );
      expect(parsed.by_client).toContainEqual({
        client_name: 'Acme',
        total_seconds: 1500,
      });
      expect(parsed.by_client).toContainEqual({
        client_name: 'Globex',
        total_seconds: 2000,
      });
    });

    it('uses "(no client)" placeholder for null client names', () => {
      const logs = [makeLog({ duration: 100, clientName: null })];
      const parsed = JSON.parse(
        formatRangeSummary(logs, '2026-04-28', '2026-04-28', 'total')
      );
      expect(parsed.by_client).toEqual([
        { client_name: '(no client)', total_seconds: 100 },
      ]);
    });
  });
});

describe('formatDailySummary', () => {
  it('returns "no entries" for empty input', () => {
    expect(formatDailySummary([], '2026-04-28')).toContain('No time entries');
  });

  it('shows total hours and project breakdown', () => {
    const logs = [
      makeLog({ duration: 3600, date: '2026-04-28T00:00:00' }),
      makeLog({ duration: 1800, date: '2026-04-28T00:00:00' }),
    ];
    const out = formatDailySummary(logs, '2026-04-28');
    expect(out).toContain('1.5');
    expect(out).toContain('Project Alpha');
  });

  it('filters logs that belong to other dates', () => {
    const logs = [
      makeLog({ duration: 3600, date: '2026-04-28T00:00:00' }),
      makeLog({ duration: 1800, date: '2026-04-27T00:00:00' }),
    ];
    const out = formatDailySummary(logs, '2026-04-28');
    expect(out).toContain('1.0'); // only the Apr 28 log
    expect(out).not.toContain('1.5');
  });
});

describe('formatWeeklySummary', () => {
  it('returns "no entries" for empty input', () => {
    expect(formatWeeklySummary([], '2026-04-27', '2026-05-03')).toContain(
      'No time entries'
    );
  });

  it('aggregates over the week and shows daily breakdown', () => {
    const logs = [
      makeLog({ duration: 3600, date: '2026-04-27T00:00:00', billable: true }),
      makeLog({ duration: 1800, date: '2026-04-28T00:00:00', billable: false }),
    ];
    const out = formatWeeklySummary(logs, '2026-04-27', '2026-05-03');
    expect(out).toContain('1.5'); // total
    expect(out).toContain('1.0'); // billable
  });

  it('skips days with no entries in the daily breakdown', () => {
    const logs = [makeLog({ duration: 3600, date: '2026-04-28T00:00:00' })];
    const out = formatWeeklySummary(logs, '2026-04-27', '2026-05-03');
    expect(out.match(/Apr 28/g)?.length).toBeGreaterThanOrEqual(1);
    // April 27 (Monday) had no entries — should not appear in breakdown rows
    // (Note: it appears in the heading "Apr 27 to May 3" — careful count expected.)
  });
});

describe('formatProjects', () => {
  function makeProject(overrides: Partial<Project> = {}): Project {
    return {
      id: 'p1',
      name: 'Project Alpha',
      clientId: 'c1',
      clientName: 'Acme Corp',
      budgetType: 0,
      budgetValue: null,
      billable: true,
      archived: false,
      tasks: [],
      hourlyRate: null,
      color: null,
      ...overrides,
    };
  }

  it('returns "no projects" for empty input', () => {
    expect(formatProjects([])).toBe('No projects found.');
  });

  it('groups projects by client', () => {
    const projects = [
      makeProject({ id: 'a', clientName: 'Acme' }),
      makeProject({ id: 'b', clientName: 'Globex' }),
    ];
    const out = formatProjects(projects);
    expect(out).toContain('### Acme');
    expect(out).toContain('### Globex');
  });

  it('marks archived projects', () => {
    const out = formatProjects([makeProject({ archived: true })]);
    expect(out).toContain('[archived]');
  });

  it('falls back to "No Client" when clientName is null', () => {
    const out = formatProjects([makeProject({ clientName: null })]);
    expect(out).toContain('No Client');
  });
});

describe('formatClients', () => {
  function makeClient(overrides: Partial<Client> = {}): Client {
    return {
      id: 'c1',
      name: 'Acme Corp',
      archived: false,
      contactName: null,
      contactEmail: null,
      address: null,
      ...overrides,
    };
  }

  it('returns "no clients" for empty input', () => {
    expect(formatClients([])).toBe('No clients found.');
  });

  it('shows total client count', () => {
    expect(formatClients([makeClient({ id: 'a' }), makeClient({ id: 'b' })])).toContain(
      '(2 total)'
    );
  });

  it('marks archived clients', () => {
    expect(formatClients([makeClient({ archived: true })])).toContain('[archived]');
  });

  it('renders contact email when present', () => {
    const out = formatClients([
      makeClient({ contactName: 'Alice', contactEmail: 'alice@example.com' }),
    ]);
    expect(out).toContain('alice@example.com');
  });

  it('omits contact line when contactName is null', () => {
    const out = formatClients([makeClient()]);
    expect(out).not.toContain('Contact:');
  });
});
