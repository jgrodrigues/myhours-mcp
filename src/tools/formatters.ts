/**
 * Formatters for MCP tool outputs
 */

import type { TimeLog, Project, Client } from '../types/api.js';
import { formatDecimalHours, formatDuration } from '../utils/duration.js';
import {
  formatDate,
  formatDateLong,
  formatDateShort,
  getDateRange,
  getWeekStart,
  parseDate,
} from '../utils/date.js';

export type RangeGranularity = 'total' | 'daily' | 'weekly' | 'monthly';

/**
 * Format a daily summary from time logs
 */
export function formatDailySummary(logs: TimeLog[], date: string): string {
  // Filter logs for the specific date
  const dayLogs = logs.filter((log) => log.date.split('T')[0] === date);

  if (dayLogs.length === 0) {
    return `## Daily Summary for ${formatDateLong(date)}\n\nNo time entries found for this date.`;
  }

  const totalSeconds = dayLogs.reduce((sum, log) => sum + log.duration, 0);
  const billableLogs = dayLogs.filter((l) => l.billable);
  const billableSeconds = billableLogs.reduce((sum, log) => sum + log.duration, 0);
  const nonBillableSeconds = totalSeconds - billableSeconds;

  // Group by project
  const byProject = groupByProject(dayLogs);

  let summary = `## Daily Summary for ${formatDateLong(date)}\n\n`;
  summary += `**Total Hours**: ${formatDecimalHours(totalSeconds)} hours`;

  if (billableSeconds > 0 || nonBillableSeconds > 0) {
    summary += ` (${formatDecimalHours(billableSeconds)} billable`;
    if (nonBillableSeconds > 0) {
      summary += `, ${formatDecimalHours(nonBillableSeconds)} non-billable`;
    }
    summary += `)`;
  }
  summary += `\n\n`;

  summary += `### By Project:\n`;

  for (const [projectName, projectLogs] of Object.entries(byProject)) {
    const projectSeconds = projectLogs.reduce((s, l) => s + l.duration, 0);
    const clientName = projectLogs[0]?.clientName || 'No Client';

    summary += `\n**${projectName}** (${clientName}): ${formatDecimalHours(projectSeconds)} hours\n`;

    // Group by task within project
    const byTask = groupByTask(projectLogs);

    for (const [taskName, taskLogs] of Object.entries(byTask)) {
      for (const log of taskLogs) {
        const note = log.note || 'No description';
        const duration = formatDuration(log.duration);
        const billableTag = log.billable ? '' : ' [non-billable]';
        summary += `  - ${taskName}: ${duration} - "${note}"${billableTag}\n`;
      }
    }
  }

  // Add running timer notice if any
  const runningLog = dayLogs.find((l) => l.running);
  if (runningLog) {
    summary += `\n---\n`;
    summary += `**Timer Running**: ${runningLog.projectName} / ${runningLog.taskName}\n`;
  }

  return summary;
}

/**
 * Format a weekly summary from time logs
 */
export function formatWeeklySummary(
  logs: TimeLog[],
  weekStart: string,
  weekEnd: string
): string {
  const dates = getDateRange(weekStart, weekEnd);

  const weekLogs = logs.filter((log) => {
    const logDate = log.date.split('T')[0];
    return logDate >= weekStart && logDate <= weekEnd;
  });

  if (weekLogs.length === 0) {
    return `## Weekly Summary (${weekStart} to ${weekEnd})\n\nNo time entries found for this week.`;
  }

  const totalSeconds = weekLogs.reduce((sum, log) => sum + log.duration, 0);
  const billableSeconds = weekLogs
    .filter((l) => l.billable)
    .reduce((sum, log) => sum + log.duration, 0);

  let summary = `## Weekly Summary (${formatDateShort(weekStart)} to ${formatDateShort(weekEnd)})\n\n`;
  summary += `**Total Hours**: ${formatDecimalHours(totalSeconds)} hours`;
  summary += ` (${formatDecimalHours(billableSeconds)} billable)\n\n`;

  // Daily breakdown
  summary += `### Daily Breakdown:\n\n`;
  summary += `| Day | Hours | Billable |\n`;
  summary += `|-----|-------|----------|\n`;

  for (const date of dates) {
    const dayLogs = weekLogs.filter((l) => l.date.split('T')[0] === date);
    const dayTotal = dayLogs.reduce((s, l) => s + l.duration, 0);
    const dayBillable = dayLogs.filter((l) => l.billable).reduce((s, l) => s + l.duration, 0);

    if (dayTotal > 0) {
      summary += `| ${formatDateShort(date)} | ${formatDecimalHours(dayTotal)} | ${formatDecimalHours(dayBillable)} |\n`;
    }
  }

  summary += `\n`;

  // Project breakdown
  summary += `### By Project:\n`;
  const byProject = groupByProject(weekLogs);

  for (const [projectName, projectLogs] of Object.entries(byProject)) {
    const projectSeconds = projectLogs.reduce((s, l) => s + l.duration, 0);
    const clientName = projectLogs[0]?.clientName || 'No Client';
    summary += `- **${projectName}** (${clientName}): ${formatDecimalHours(projectSeconds)} hours\n`;
  }

  return summary;
}

/**
 * Format projects list
 */
export function formatProjects(projects: Project[]): string {
  if (projects.length === 0) {
    return 'No projects found.';
  }

  let output = `## Available Projects (${projects.length} total)\n\n`;

  // Group by client
  const byClient: Record<string, Project[]> = {};

  for (const project of projects) {
    const clientName = project.clientName || 'No Client';
    if (!byClient[clientName]) {
      byClient[clientName] = [];
    }
    byClient[clientName].push(project);
  }

  for (const [clientName, clientProjects] of Object.entries(byClient)) {
    output += `### ${clientName}\n\n`;

    for (const project of clientProjects) {
      const status = project.archived ? ' [archived]' : '';
      const billable = project.billable ? 'Billable' : 'Non-billable';

      output += `**${project.name}**${status}\n`;
      output += `- ID: \`${project.id}\`\n`;
      output += `- ${billable}\n`;

      if (project.tasks && project.tasks.length > 0) {
        output += `- Tasks:\n`;
        for (const task of project.tasks) {
          const taskStatus = task.archived ? ' [archived]' : '';
          output += `  - ${task.name} (ID: \`${task.id}\`)${taskStatus}\n`;
        }
      }
      output += `\n`;
    }
  }

  return output;
}

/**
 * Format clients list
 */
export function formatClients(clients: Client[]): string {
  if (clients.length === 0) {
    return 'No clients found.';
  }

  let output = `## Clients (${clients.length} total)\n\n`;

  for (const client of clients) {
    const status = client.archived ? ' [archived]' : '';
    output += `**${client.name}**${status}\n`;
    output += `- ID: \`${client.id}\`\n`;

    if (client.contactName) {
      output += `- Contact: ${client.contactName}`;
      if (client.contactEmail) {
        output += ` (${client.contactEmail})`;
      }
      output += `\n`;
    }

    output += `\n`;
  }

  return output;
}

/**
 * Format time logs list
 */
export function formatTimeLogs(logs: TimeLog[]): string {
  if (logs.length === 0) {
    return 'No time logs found.';
  }

  let output = `## Time Logs (${logs.length} entries)\n\n`;

  // Group by date
  const byDate: Record<string, TimeLog[]> = {};

  for (const log of logs) {
    const date = log.date.split('T')[0];
    if (!byDate[date]) {
      byDate[date] = [];
    }
    byDate[date].push(log);
  }

  // Sort dates descending
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  for (const date of dates) {
    const dayLogs = byDate[date];
    const dayTotal = dayLogs.reduce((s, l) => s + l.duration, 0);

    output += `### ${formatDateShort(date)} (${formatDecimalHours(dayTotal)} hours)\n\n`;

    for (const log of dayLogs) {
      const duration = formatDuration(log.duration);
      const project = log.projectName || 'No Project';
      const task = log.taskName || 'No Task';
      const note = log.note || 'No description';
      const billable = log.billable ? '' : ' [non-billable]';
      const running = log.running ? ' **[RUNNING]**' : '';

      output += `- **${project} / ${task}**: ${duration}${billable}${running}\n`;
      output += `  - ID: \`${log.id}\`\n`;
      output += `  - Note: ${note}\n`;
    }

    output += `\n`;
  }

  return output;
}

/**
 * Format time logs as structured JSON for machine consumption.
 *
 * Companion to formatTimeLogs (markdown / human-readable). This returns precise
 * raw data so consumers (LLMs, scripts) can sum exactly without losing seconds
 * to the "Xh Ym" display truncation in formatDuration().
 *
 * --------------------------------------------------------------------------
 * TODO: implement the JSON shape. Three meaningful design choices below —
 *       these shape how the tool is used downstream, so they're worth your input.
 *
 *   1) Per-entry fields — full TimeLog passthrough (~20 fields, verbose) or a
 *      curated subset (id, date, duration_seconds, project, task, billable, note)?
 *      Trade-off: completeness for unknown future use cases vs. token cost
 *      every time the tool is called.
 *
 *   2) Duration representation — `duration_seconds` only (one source of truth),
 *      or also include `duration_minutes` and `duration_hours` decimals for
 *      caller convenience? Multiple representations risk drift if someone
 *      hand-edits one without the others.
 *
 *   3) Aggregates — include a `summary` block with precomputed totals
 *      (overall, per-day, per-project, billable vs non-billable), or just
 *      dump entries and let the caller sum? Aggregates are convenient but
 *      duplicate state; pure entries are minimal but push work to callers.
 *
 * Replace the throw below with your implementation. Return a JSON string
 * (use JSON.stringify(payload, null, 2) for readable output).
 * --------------------------------------------------------------------------
 */
export function formatTimeLogsRaw(
  logs: TimeLog[],
  dateFrom: string,
  dateTo: string
): string {
  const entries = logs.map((l) => ({
    id: l.id,
    date: l.date.split('T')[0],
    duration_seconds: l.duration,
    duration_display: formatDuration(l.duration),
    project_id: l.projectId,
    project_name: l.projectName,
    task_id: l.taskId,
    task_name: l.taskName,
    client_name: l.clientName,
    billable: l.billable,
    billed: l.billed,
    note: l.note,
  }));

  const totalSeconds = logs.reduce((s, l) => s + l.duration, 0);
  const billableSeconds = logs
    .filter((l) => l.billable)
    .reduce((s, l) => s + l.duration, 0);

  const byDate = new Map<string, number>();
  for (const e of entries) {
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.duration_seconds);
  }
  const by_date = Array.from(byDate.entries())
    .map(([date, seconds]) => ({ date, total_seconds: seconds }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byProject = new Map<string, { name: string | null; seconds: number }>();
  for (const l of logs) {
    const key = l.projectId ?? '__none__';
    const cur = byProject.get(key);
    if (cur) {
      cur.seconds += l.duration;
    } else {
      byProject.set(key, { name: l.projectName, seconds: l.duration });
    }
  }
  const by_project = Array.from(byProject.entries()).map(
    ([id, { name, seconds }]) => ({
      project_id: id === '__none__' ? null : id,
      project_name: name,
      total_seconds: seconds,
    })
  );

  const payload = {
    date_from: dateFrom,
    date_to: dateTo,
    entry_count: entries.length,
    summary: {
      total_seconds: totalSeconds,
      billable_seconds: billableSeconds,
      non_billable_seconds: totalSeconds - billableSeconds,
      by_date,
      by_project,
    },
    entries,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Aggregate time logs into a structured summary for a date range.
 *
 * Returns total/billable seconds, optional time-bucketed breakdown
 * (`total | daily | weekly | monthly`), per-project totals, and
 * per-client totals — all derived from raw seconds, never from
 * formatted strings.
 *
 * Buckets are only emitted for periods that actually contain entries
 * (no zero-row padding). Entries are not returned — use
 * `formatTimeLogsRaw` if per-entry detail is needed.
 */
export function formatRangeSummary(
  logs: TimeLog[],
  dateFrom: string,
  dateTo: string,
  granularity: RangeGranularity
): string {
  const totalSeconds = logs.reduce((s, l) => s + l.duration, 0);
  const billableSeconds = logs
    .filter((l) => l.billable)
    .reduce((s, l) => s + l.duration, 0);

  type Period = {
    period_start: string;
    period_end: string;
    total_seconds: number;
    billable_seconds: number;
    entry_count: number;
  };
  const periods = new Map<string, Period>();

  for (const log of logs) {
    const date = log.date.split('T')[0];
    const { key, period_start, period_end } = bucketFor(
      date,
      granularity,
      dateFrom,
      dateTo
    );

    let cur = periods.get(key);
    if (!cur) {
      cur = {
        period_start,
        period_end,
        total_seconds: 0,
        billable_seconds: 0,
        entry_count: 0,
      };
      periods.set(key, cur);
    }
    cur.total_seconds += log.duration;
    if (log.billable) cur.billable_seconds += log.duration;
    cur.entry_count += 1;
  }

  const by_period = Array.from(periods.values()).sort((a, b) =>
    a.period_start.localeCompare(b.period_start)
  );

  const byProjectMap = new Map<string, { name: string | null; seconds: number }>();
  for (const log of logs) {
    const key = log.projectId ?? '__none__';
    const cur = byProjectMap.get(key);
    if (cur) {
      cur.seconds += log.duration;
    } else {
      byProjectMap.set(key, { name: log.projectName, seconds: log.duration });
    }
  }
  const by_project = Array.from(byProjectMap.entries()).map(
    ([id, { name, seconds }]) => ({
      project_id: id === '__none__' ? null : id,
      project_name: name,
      total_seconds: seconds,
    })
  );

  const byClientMap = new Map<string, number>();
  for (const log of logs) {
    const key = log.clientName ?? '(no client)';
    byClientMap.set(key, (byClientMap.get(key) ?? 0) + log.duration);
  }
  const by_client = Array.from(byClientMap.entries()).map(
    ([client_name, total_seconds]) => ({ client_name, total_seconds })
  );

  const payload = {
    date_from: dateFrom,
    date_to: dateTo,
    granularity,
    summary: {
      total_seconds: totalSeconds,
      billable_seconds: billableSeconds,
      non_billable_seconds: totalSeconds - billableSeconds,
      entry_count: logs.length,
    },
    by_period,
    by_project,
    by_client,
  };

  return JSON.stringify(payload, null, 2);
}

function bucketFor(
  date: string,
  granularity: RangeGranularity,
  dateFrom: string,
  dateTo: string
): { key: string; period_start: string; period_end: string } {
  if (granularity === 'total') {
    return { key: 'total', period_start: dateFrom, period_end: dateTo };
  }
  if (granularity === 'daily') {
    return { key: date, period_start: date, period_end: date };
  }
  if (granularity === 'weekly') {
    const monday = getWeekStart(parseDate(date));
    const sunday = formatDate(addDaysToDate(parseDate(monday), 6));
    return { key: monday, period_start: monday, period_end: sunday };
  }
  // monthly
  const yyyymm = date.substring(0, 7);
  const [year, month] = yyyymm.split('-').map(Number);
  const lastDay = new Date(year, month, 0); // month is 1-indexed → last day of `month`
  return {
    key: yyyymm,
    period_start: `${yyyymm}-01`,
    period_end: formatDate(lastDay),
  };
}

function addDaysToDate(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

// ============================================
// Helper functions
// ============================================

function groupByProject(logs: TimeLog[]): Record<string, TimeLog[]> {
  const result: Record<string, TimeLog[]> = {};

  for (const log of logs) {
    const key = log.projectName || 'No Project';
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(log);
  }

  return result;
}

function groupByTask(logs: TimeLog[]): Record<string, TimeLog[]> {
  const result: Record<string, TimeLog[]> = {};

  for (const log of logs) {
    const key = log.taskName || 'No Task';
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(log);
  }

  return result;
}
