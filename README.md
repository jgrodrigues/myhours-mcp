# MyHours MCP Server

> Connect your [MyHours](https://myhours.com) time tracking to Claude (or any MCP-compatible AI client) for natural-language summaries, reporting, and timer control.

[![npm version](https://img.shields.io/npm/v/myhours-mcp.svg)](https://www.npmjs.com/package/myhours-mcp)
[![CI](https://github.com/jgrodrigues/myhours-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jgrodrigues/myhours-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/node/v/myhours-mcp)](https://www.npmjs.com/package/myhours-mcp)

## What it does

This is a [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes your MyHours account to AI assistants. Once configured, you can ask Claude things like:

- *"Summarize what I worked on yesterday so I can paste it in my timesheet."*
- *"Log 2 hours on Project X for frontend work."*
- *"Start a timer on the API project."*
- *"How many billable hours did I do this week, broken down by client?"*

The server runs locally, holds nothing in memory between requests, and only talks to MyHours when a tool is called.

## Requirements

- Node.js **24+**
- A MyHours account with API access (Settings → Integrations → API Keys)

## Install

```bash
npm install -g myhours-mcp
```

Or run on demand without installing:

```bash
npx myhours-mcp
```

## Configure

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "myhours": {
      "command": "npx",
      "args": ["myhours-mcp"],
      "env": {
        "MYHOURS_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "myhours": {
      "command": "npx",
      "args": ["myhours-mcp"],
      "env": {
        "MYHOURS_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Restart Claude after editing the config.

### Other MCP clients

Any client that speaks MCP over stdio works. Set `MYHOURS_API_KEY` in the environment and run `myhours-mcp`.

## Tools

The server exposes 13 tools, grouped by purpose.

### Reading

| Tool | Output | Description |
|------|--------|-------------|
| `myhours_get_daily_summary` | Markdown | Formatted summary for a single day, grouped by project and task. Defaults to today. |
| `myhours_get_weekly_summary` | Markdown | A week's totals with daily breakdown and billable split. Defaults to the current week. |
| `myhours_get_time_logs` | Markdown | Raw time entries for a date range, optionally filtered by project. |
| `myhours_get_range_summary` | JSON | Aggregated totals over a date range with optional bucketing (`day`, `week`, `month`). |
| `myhours_get_time_logs_raw` | JSON | Time entries as structured JSON — useful when you want Claude to do its own analysis. |

### Discovery

| Tool | Description |
|------|-------------|
| `myhours_list_projects` | All projects with their tasks. Pass `include_archived: true` to see archived ones. |
| `myhours_list_clients` | All clients on the account. |

### Writing

| Tool | Description |
|------|-------------|
| `myhours_add_time_log` | Add a new time entry (project + task + date + duration). |
| `myhours_edit_time_log` | Edit an existing entry by ID. |
| `myhours_delete_time_log` | Delete an entry by ID. **Not reversible.** |

### Timer control

| Tool | Description |
|------|-------------|
| `myhours_start_timer` | Start tracking on a project + task. Refuses if a timer is already running. |
| `myhours_stop_timer` | Stop the currently running timer. |
| `myhours_get_running_timer` | Check whether a timer is running, and on what. |

## Example

Asking Claude *"What did I work on yesterday?"*:

```
## Daily Summary for 2026-05-07

**Total Hours**: 8.5 hours (7.5 billable)

### By Project

- **Website Redesign** (Acme Corp): 5.5 hours
  - Frontend Development — 3h — "Implemented responsive navigation"
  - Bug Fixes — 2.5h — "Fixed checkout flow issues"

- **Internal Tools**: 3 hours
  - Documentation — 3h — "Updated API documentation"
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MYHOURS_API_KEY` | yes | — | API key from MyHours → Settings → Integrations |
| `MYHOURS_BASE_URL` | no | `https://api2.myhours.com/api` | Override only for self-hosted or test endpoints |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `MYHOURS_API_KEY environment variable is required` | Add the key to your client's MCP config (`env` block above). |
| `MyHours API error (401)` | API key is invalid or revoked — generate a new one. |
| `MyHours API error (403)` | Your account lacks permission for that project/operation. |
| Tools don't appear in Claude | Restart the client to reload MCP servers. |
| Empty project list | Make sure you're assigned to projects in MyHours. |

## Privacy

- Your API key lives in your MCP client config. It never leaves your machine except as the `Authorization` header to `api2.myhours.com`.
- The server makes no telemetry calls and stores no data.
- Requests to MyHours only happen when you invoke a tool.

## Development

```bash
git clone https://github.com/jgrodrigues/myhours-mcp.git
cd myhours-mcp
pnpm install

# Run from source against your account
export MYHOURS_API_KEY=your_key_here
pnpm dev

# Build and run the compiled output
pnpm build
pnpm start

# Run the test suite
pnpm test
```

The server speaks MCP over stdio. To poke at it manually:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | MYHOURS_API_KEY=... npx myhours-mcp
```

## Contributing

Issues and pull requests are welcome at [github.com/jgrodrigues/myhours-mcp](https://github.com/jgrodrigues/myhours-mcp). Please open an issue before starting any non-trivial change so we can discuss the approach.

## License

MIT — see [LICENSE](LICENSE).

## Links

- [MyHours](https://myhours.com)
- [MyHours API docs](https://documenter.getpostman.com/view/8879268/TVmV4YYU)
- [Model Context Protocol](https://modelcontextprotocol.io/)
