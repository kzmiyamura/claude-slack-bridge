# claude-slack-bridge 🤖

Control [Claude Code](https://docs.anthropic.com/claude-code) from Slack. Send instructions from your phone or any device — Claude works on your local machine.

## Demo

```
You:  .claude Create a React Todo app
Bot:  ⏳ Got it! Working...
Bot:  ✅ Done! Created src/TodoApp.tsx
```

## Features

- 💬 Control Claude Code from Slack
- 📁 Navigate your local filesystem via Slack
- 📄 Read file contents from Slack
- 💾 Remembers last working directory across restarts
- 🔄 Auto-restarts on crash (via launchd / systemd)
- 🔍 Auto-detects Claude path (nvm, homebrew, etc.)

## Requirements

- Node.js v20+
- [Claude Code](https://docs.anthropic.com/claude-code) (`npm install -g @anthropic-ai/claude-code`)
- A Slack workspace where you can create apps

## Quick Start

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/claude-slack-bridge.git
cd claude-slack-bridge
npm install
```

### 2. Create a Slack App

1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**
2. Under **OAuth & Permissions** → **Scopes** → add:
   - `channels:history`
   - `chat:write`
   - `channels:read`
3. Click **Install to Workspace**
4. Copy the **Bot User OAuth Token** (`xoxb-...`)
5. Invite the bot to your channel: `/invite @your-bot-name`
6. Get your channel ID (right-click channel → **Copy Link** → last part of URL)

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_CHANNEL_ID=C0XXXXXXXXX
POLL_INTERVAL_MS=5000
OUTPUT_DIR=~/Desktop
```

### 4. Run

```bash
npm run build
npm start
```

### 5. Auto-start on login (macOS)

```bash
chmod +x scripts/setup-launchd.sh
./scripts/setup-launchd.sh
```

### 6. Auto-start on login (Linux)

```bash
chmod +x scripts/setup-systemd.sh
./scripts/setup-systemd.sh
```

## Commands

| Command | Description |
|---------|-------------|
| `.claude <prompt>` | Send instructions to Claude Code |
| `.ls [path]` | List directory contents |
| `.cd <path>` | Change working directory |
| `.cd ..` | Go up one directory |
| `.pwd` | Show current directory |
| `.read <file> [page]` | Read file contents (paginated) |
| `.h` / `.help` | Show this command list |

## Examples

```
.claude Create an Express API with CRUD endpoints for users
.claude Add TypeScript types to all files in src/
.claude Fix the bug in components/Header.tsx
.ls
.cd my-project
.read README.md
.read README.md 2
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SLACK_BOT_TOKEN` | required | Bot User OAuth Token |
| `SLACK_CHANNEL_ID` | required | Channel to monitor |
| `POLL_INTERVAL_MS` | `5000` | Polling interval in ms |
| `OUTPUT_DIR` | `~/Desktop` | Initial working directory |
| `CLAUDE_PATH` | auto-detect | Path to claude binary |

## How it works

The bot polls the Slack channel every 5 seconds for new messages starting with `.`. When it finds one, it runs Claude Code in the configured working directory and returns the output to Slack.

No webhooks or public URLs required — works entirely from your local machine.

## License

MIT
