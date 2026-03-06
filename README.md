# claude-slack-bridge 🤖

SlackからMacのClaude Codeを操作できるボットです。スマホや外出先からClaudeに指示を出せます。

Control [Claude Code](https://docs.anthropic.com/claude-code) on your Mac from Slack. Send instructions from your phone or any device.

## デモ / Demo

```
あなた: .claude ReactのTodoアプリを作って
Bot:    ⏳ 承りました！作業中です...
Bot:    ✅ 完了！src/TodoApp.tsx を作成しました
```

## 特徴 / Features

- 💬 SlackからClaude Codeに指示を出せる
- 📁 Slackからローカルのファイルシステムを操作できる
- 📄 Slackからファイルの内容を読める
- 💾 再起動後も作業ディレクトリを記憶
- 🔄 クラッシュ時に自動再起動（launchd / systemd）
- 🔍 Claudeのパスを自動検出（nvm, Homebrew など）

## 必要なもの / Requirements

- Node.js v20+
- [Claude Code](https://docs.anthropic.com/claude-code) (`npm install -g @anthropic-ai/claude-code`)
- Appを作成できるSlackワークスペース

## セットアップ / Setup

### 1. クローン / Clone

```bash
git clone https://github.com/YOUR_USERNAME/claude-slack-bridge.git
cd claude-slack-bridge
npm install
```

### 2. Slack Appの作成 / Create a Slack App

1. https://api.slack.com/apps を開き **Create New App** → **From scratch** をクリック
2. **OAuth & Permissions** → **Scopes** に以下を追加：
   - `channels:history`
   - `chat:write`
   - `channels:read`
3. **Install to Workspace** をクリック
4. **Bot User OAuth Token**（`xoxb-...`）をコピー
5. ボットをチャンネルに招待：`/invite @ボット名`
6. チャンネルIDを取得（チャンネルを右クリック → **リンクをコピー** → URLの末尾）

### 3. 設定ファイルの作成 / Configure

```bash
cp .env.example .env
```

`.env` を編集：

```env
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_CHANNEL_ID=C0XXXXXXXXX
POLL_INTERVAL_MS=5000
OUTPUT_DIR=~/Desktop
```

### 4. 起動 / Run

```bash
npm run build
npm start
```

### 5. ログイン時に自動起動（macOS）/ Auto-start on login (macOS)

```bash
chmod +x scripts/setup-launchd.sh
./scripts/setup-launchd.sh
```

### 6. ログイン時に自動起動（Linux）/ Auto-start on login (Linux)

```bash
chmod +x scripts/setup-systemd.sh
./scripts/setup-systemd.sh
```

## コマンド一覧 / Commands

| コマンド | 説明 |
|---------|------|
| `.claude <指示>` | Claude Codeに指示を送る |
| `.ls [パス]` | ディレクトリ一覧を表示 |
| `.cd <パス>` | ディレクトリを移動 |
| `.cd ..` | 一つ上のディレクトリへ移動 |
| `.pwd` | 現在のディレクトリを表示 |
| `.read <ファイル> [ページ]` | ファイルの内容を表示（ページ送り対応） |
| `.h` / `.help` | コマンド一覧を表示 |

## 使用例 / Examples

```
.claude ReactのTodoアプリを作って
.claude src/以下の全ファイルにTypeScriptの型をつけて
.claude components/Header.tsx のバグを直して
.ls
.cd my-project
.read README.md
.read README.md 2
```

## 設定項目 / Configuration

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `SLACK_BOT_TOKEN` | 必須 | Bot User OAuth Token |
| `SLACK_CHANNEL_ID` | 必須 | 監視するチャンネルID |
| `POLL_INTERVAL_MS` | `5000` | ポーリング間隔（ミリ秒） |
| `OUTPUT_DIR` | `~/Desktop` | 初期作業ディレクトリ |
| `CLAUDE_PATH` | 自動検出 | claudeコマンドのパス |

## 仕組み / How it works

5秒ごとにSlackチャンネルを監視し、`.`で始まるメッセージを検出するとClaude Codeを実行してその結果をSlackに返します。

WebhookやパブリックURLは不要です。ローカルマシン上で完結します。

The bot polls the Slack channel every 5 seconds for new messages starting with `.`. No webhooks or public URLs required.

## License

MIT
