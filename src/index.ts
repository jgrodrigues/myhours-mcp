#!/usr/bin/env node

/**
 * MyHours MCP Server
 *
 * An MCP server that integrates with MyHours time tracking,
 * enabling AI assistants to read, summarize, and manage time entries.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { MyHoursClient } from './client.js';
import {
  formatDailySummary,
  formatWeeklySummary,
  formatProjects,
  formatClients,
  formatTimeLogs,
  formatTimeLogsRaw,
  formatRangeSummary,
  type RangeGranularity,
} from './tools/formatters.js';
import {
  getToday,
  getWeekStart,
  addDays,
  isValidDateString,
} from './utils/date.js';
import { hoursToSeconds } from './utils/duration.js';

// Get API key from environment
const API_KEY = process.env.MYHOURS_API_KEY;

if (!API_KEY) {
  console.error('Error: MYHOURS_API_KEY environment variable is required');
  console.error('');
  console.error('To get your API key:');
  console.error('1. Log into MyHours (https://myhours.com)');
  console.error('2. Go to Settings > Integrations > API Keys');
  console.error('3. Generate a new key');
  process.exit(1);
}

// Initialize the MyHours client
const client = new MyHoursClient({
  apiKey: API_KEY,
  baseUrl: process.env.MYHOURS_BASE_URL,
});

// Create the MCP server
const server = new Server(
  {
    name: 'myhours-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================
// Tool Definitions
// ============================================

const TOOLS = [
  {
    name: 'myhours_get_daily_summary',
    description:
      'Get a formatted summary of work done on a specific date, perfect for justifying billable hours. Shows total hours, breakdown by project/task, and notes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description:
            'Date in YYYY-MM-DD format. Defaults to today if not specified.',
        },
      },
    },
  },
  {
    name: 'myhours_get_weekly_summary',
    description:
      'Get a summary of work done for an entire week. Shows daily breakdown, project totals, and billable vs non-billable hours.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        week_start: {
          type: 'string',
          description:
            "Start of week (Monday) in YYYY-MM-DD format. Defaults to current week's Monday.",
        },
      },
    },
  },
  {
    name: 'myhours_get_time_logs',
    description:
      'Get raw time log entries for a date range. Useful for detailed inspection of time entries.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date_from: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format.',
        },
        date_to: {
          type: 'string',
          description:
            'End date in YYYY-MM-DD format. Defaults to date_from (single day).',
        },
        project_id: {
          type: 'string',
          description: 'Filter by project ID (optional).',
        },
      },
      required: ['date_from'],
    },
  },
  {
    name: 'myhours_get_range_summary',
    description:
      'Aggregate time over a date range and return totals as structured JSON. Optional granularity buckets the totals into daily, weekly, or monthly periods. Use this for reports, billing reconciliation, and monthly/quarterly summaries — much smaller response than fetching all entries.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date_from: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format.',
        },
        date_to: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format.',
        },
        granularity: {
          type: 'string',
          enum: ['total', 'daily', 'weekly', 'monthly'],
          description:
            'How to bucket the totals. "total" returns a single bucket for the full range; "monthly" returns one bucket per calendar month, etc. Defaults to "total".',
        },
        project_id: {
          type: 'string',
          description: 'Filter by project ID (optional).',
        },
      },
      required: ['date_from', 'date_to'],
    },
  },
  {
    name: 'myhours_get_time_logs_raw',
    description:
      'Get time log entries as structured JSON (machine-readable) for a date range. Use this when precise summing or programmatic processing is needed — durations are returned as raw seconds without display truncation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date_from: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format.',
        },
        date_to: {
          type: 'string',
          description:
            'End date in YYYY-MM-DD format. Defaults to date_from (single day).',
        },
        project_id: {
          type: 'string',
          description: 'Filter by project ID (optional).',
        },
      },
      required: ['date_from'],
    },
  },
  {
    name: 'myhours_list_projects',
    description:
      'List all available projects and their tasks. Use this to find project and task IDs for logging time.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        include_archived: {
          type: 'boolean',
          description: 'Include archived projects. Defaults to false.',
        },
      },
    },
  },
  {
    name: 'myhours_list_clients',
    description: 'List all clients in your MyHours account.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'myhours_add_time_log',
    description:
      'Add a new time entry. Requires project ID and task ID (use myhours_list_projects to find them).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID (use myhours_list_projects to find).',
        },
        task_id: {
          type: 'string',
          description: 'Task ID within the project.',
        },
        date: {
          type: 'string',
          description: 'Date for the entry in YYYY-MM-DD format.',
        },
        duration_hours: {
          type: 'number',
          description: 'Duration in hours (e.g., 2.5 for 2 hours 30 minutes).',
        },
        note: {
          type: 'string',
          description: 'Description of work done.',
        },
        billable: {
          type: 'boolean',
          description:
            'Whether the time is billable. Defaults to project setting.',
        },
      },
      required: ['project_id', 'task_id', 'date', 'duration_hours'],
    },
  },
  {
    name: 'myhours_edit_time_log',
    description: 'Edit an existing time entry.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        log_id: {
          type: 'string',
          description: 'ID of the time log to edit.',
        },
        duration_hours: {
          type: 'number',
          description: 'New duration in hours.',
        },
        note: {
          type: 'string',
          description: 'New description.',
        },
        billable: {
          type: 'boolean',
          description: 'Whether the time is billable.',
        },
      },
      required: ['log_id'],
    },
  },
  {
    name: 'myhours_delete_time_log',
    description: 'Delete a time entry. This action cannot be undone.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        log_id: {
          type: 'string',
          description: 'ID of the time log to delete.',
        },
      },
      required: ['log_id'],
    },
  },
  {
    name: 'myhours_start_timer',
    description: 'Start tracking time on a specific project and task.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID.',
        },
        task_id: {
          type: 'string',
          description: 'Task ID.',
        },
        note: {
          type: 'string',
          description: 'Description of work to be done.',
        },
      },
      required: ['project_id', 'task_id'],
    },
  },
  {
    name: 'myhours_stop_timer',
    description: 'Stop the currently running timer.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        log_id: {
          type: 'string',
          description:
            'ID of the running timer log. If not provided, will try to find and stop any running timer.',
        },
      },
    },
  },
  {
    name: 'myhours_get_running_timer',
    description: 'Check if there is a timer currently running.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

// ============================================
// Request Handlers
// ============================================

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ----------------------------------------
      // Reading Tools
      // ----------------------------------------

      case 'myhours_get_daily_summary': {
        const date = (args?.date as string) || getToday();

        if (!isValidDateString(date)) {
          return errorResponse('Invalid date format. Use YYYY-MM-DD.');
        }

        const logs = await client.getRecentLogs(date, 100);
        const summary = formatDailySummary(logs, date);
        return textResponse(summary);
      }

      case 'myhours_get_weekly_summary': {
        const weekStart = (args?.week_start as string) || getWeekStart();
        const weekEnd = addDays(weekStart, 6);

        if (!isValidDateString(weekStart)) {
          return errorResponse('Invalid date format. Use YYYY-MM-DD.');
        }

        const logs = await client.getLogsForDateRange(weekStart, weekEnd);
        const summary = formatWeeklySummary(logs, weekStart, weekEnd);
        return textResponse(summary);
      }

      case 'myhours_get_time_logs': {
        const dateFrom = args?.date_from as string;
        const dateTo = (args?.date_to as string) || dateFrom;
        const projectId = args?.project_id as string | undefined;

        if (!dateFrom || !isValidDateString(dateFrom)) {
          return errorResponse('date_from is required in YYYY-MM-DD format.');
        }

        if (dateTo && !isValidDateString(dateTo)) {
          return errorResponse('date_to must be in YYYY-MM-DD format.');
        }

        let logs = await client.getLogsForDateRange(dateFrom, dateTo);

        if (projectId) {
          logs = logs.filter((log) => log.projectId === projectId);
        }

        const formatted = formatTimeLogs(logs);
        return textResponse(formatted);
      }

      case 'myhours_get_range_summary': {
        const dateFrom = args?.date_from as string;
        const dateTo = args?.date_to as string;
        const granularity = (args?.granularity as RangeGranularity) || 'total';
        const projectId = args?.project_id as string | undefined;

        if (!dateFrom || !isValidDateString(dateFrom)) {
          return errorResponse('date_from is required in YYYY-MM-DD format.');
        }
        if (!dateTo || !isValidDateString(dateTo)) {
          return errorResponse('date_to is required in YYYY-MM-DD format.');
        }
        if (!['total', 'daily', 'weekly', 'monthly'].includes(granularity)) {
          return errorResponse(
            'granularity must be one of: total, daily, weekly, monthly.'
          );
        }

        let logs = await client.getLogsForDateRange(dateFrom, dateTo);
        if (projectId) {
          logs = logs.filter((log) => log.projectId === projectId);
        }

        const json = formatRangeSummary(logs, dateFrom, dateTo, granularity);
        return textResponse(json);
      }

      case 'myhours_get_time_logs_raw': {
        const dateFrom = args?.date_from as string;
        const dateTo = (args?.date_to as string) || dateFrom;
        const projectId = args?.project_id as string | undefined;

        if (!dateFrom || !isValidDateString(dateFrom)) {
          return errorResponse('date_from is required in YYYY-MM-DD format.');
        }

        if (dateTo && !isValidDateString(dateTo)) {
          return errorResponse('date_to must be in YYYY-MM-DD format.');
        }

        let logs = await client.getLogsForDateRange(dateFrom, dateTo);

        if (projectId) {
          logs = logs.filter((log) => log.projectId === projectId);
        }

        const json = formatTimeLogsRaw(logs, dateFrom, dateTo);
        return textResponse(json);
      }

      case 'myhours_list_projects': {
        const includeArchived = args?.include_archived as boolean;

        const projects = await client.getProjectsWithTasks(includeArchived);

        const formatted = formatProjects(projects);
        return textResponse(formatted);
      }

      case 'myhours_list_clients': {
        const clients = await client.getClients();
        const formatted = formatClients(clients);
        return textResponse(formatted);
      }

      // ----------------------------------------
      // Writing Tools
      // ----------------------------------------

      case 'myhours_add_time_log': {
        const projectId = args?.project_id as string;
        const taskId = args?.task_id as string;
        const date = args?.date as string;
        const durationHours = args?.duration_hours as number;
        const note = args?.note as string | undefined;
        const billable = args?.billable as boolean | undefined;

        if (!projectId || !taskId || !date || durationHours === undefined) {
          return errorResponse(
            'project_id, task_id, date, and duration_hours are required.'
          );
        }

        if (!isValidDateString(date)) {
          return errorResponse('Invalid date format. Use YYYY-MM-DD.');
        }

        if (durationHours <= 0) {
          return errorResponse('duration_hours must be greater than 0.');
        }

        const result = await client.addTimeLog({
          projectId,
          taskId,
          date,
          duration: hoursToSeconds(durationHours),
          note,
          billable,
        });

        return textResponse(
          `Time log created successfully!\n\n` +
            `- Project: ${result.projectName}\n` +
            `- Task: ${result.taskName}\n` +
            `- Duration: ${durationHours} hours\n` +
            `- Date: ${date}\n` +
            `- Note: ${note || 'None'}\n` +
            `- ID: \`${result.id}\``
        );
      }

      case 'myhours_edit_time_log': {
        const logId = args?.log_id as string;
        const durationHours = args?.duration_hours as number | undefined;
        const note = args?.note as string | undefined;
        const billable = args?.billable as boolean | undefined;

        if (!logId) {
          return errorResponse('log_id is required.');
        }

        const updateData: Record<string, unknown> = {};

        if (durationHours !== undefined) {
          updateData.duration = hoursToSeconds(durationHours);
        }
        if (note !== undefined) {
          updateData.note = note;
        }
        if (billable !== undefined) {
          updateData.billable = billable;
        }

        if (Object.keys(updateData).length === 0) {
          return errorResponse(
            'At least one field to update must be provided.'
          );
        }

        const result = await client.editTimeLog(logId, updateData);

        return textResponse(
          `Time log updated successfully!\n\n` +
            `- Project: ${result.projectName}\n` +
            `- Task: ${result.taskName}\n` +
            `- ID: \`${result.id}\``
        );
      }

      case 'myhours_delete_time_log': {
        const logId = args?.log_id as string;

        if (!logId) {
          return errorResponse('log_id is required.');
        }

        await client.deleteTimeLog(logId);

        return textResponse(`Time log \`${logId}\` deleted successfully.`);
      }

      // ----------------------------------------
      // Timer Tools
      // ----------------------------------------

      case 'myhours_start_timer': {
        const projectId = args?.project_id as string;
        const taskId = args?.task_id as string;
        const note = args?.note as string | undefined;

        if (!projectId || !taskId) {
          return errorResponse('project_id and task_id are required.');
        }

        // Check if timer is already running
        const running = await client.getRunningTimer();
        if (running) {
          return errorResponse(
            `A timer is already running on "${running.projectName} / ${running.taskName}".\n` +
              `Stop it first with myhours_stop_timer (log_id: \`${running.id}\`).`
          );
        }

        const result = await client.startTimer({
          projectId,
          taskId,
          note,
        });

        return textResponse(
          `Timer started!\n\n` +
            `- Project: ${result.projectName}\n` +
            `- Task: ${result.taskName}\n` +
            `- Note: ${note || 'None'}\n` +
            `- Log ID: \`${result.id}\``
        );
      }

      case 'myhours_stop_timer': {
        let logId = args?.log_id as string | undefined;

        // If no log_id provided, find the running timer
        if (!logId) {
          const running = await client.getRunningTimer();
          if (!running) {
            return textResponse('No timer is currently running.');
          }
          logId = running.id;
        }

        const result = await client.stopTimer(logId);

        return textResponse(
          `Timer stopped!\n\n` +
            `- Project: ${result.projectName}\n` +
            `- Task: ${result.taskName}\n` +
            `- Duration: ${Math.round(result.duration / 60)} minutes\n` +
            `- Log ID: \`${result.id}\``
        );
      }

      case 'myhours_get_running_timer': {
        const running = await client.getRunningTimer();

        if (!running) {
          return textResponse('No timer is currently running.');
        }

        // Calculate elapsed time from startTime
        let elapsedMinutes = 0;
        if (running.startTime) {
          const startTime = new Date(running.startTime).getTime();
          const now = Date.now();
          elapsedMinutes = Math.round((now - startTime) / 60000);
        }

        return textResponse(
          `Timer is running!\n\n` +
            `- Project: ${running.projectName}\n` +
            `- Task: ${running.taskName}\n` +
            `- Note: ${running.note || 'None'}\n` +
            `- Elapsed: ${elapsedMinutes} minutes\n` +
            `- Log ID: \`${running.id}\``
        );
      }

      default:
        return errorResponse(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(`API Error: ${message}`);
  }
});

// ============================================
// Response Helpers
// ============================================

function textResponse(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
  };
}

function errorResponse(message: string) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true,
  };
}

// ============================================
// Start Server
// ============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP communication
  console.error('MyHours MCP server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
