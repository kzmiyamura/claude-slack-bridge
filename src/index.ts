import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as dotenv from "dotenv";

dotenv.config();

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN!;
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID!;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "5000");
const HOME = os.homedir();
const STATE_FILE = path.resolve(__dirname, "../state.json");

if (!SLACK_TOKEN || !CHANNEL_ID) {
  console.error("❌ エラー: .envファイルにSLACK_BOT_TOKENとSLACK_CHANNEL_IDを設定してください");
  process.exit(1);
}

// claudeコマンドのパスを自動検出
function findClaudePath(): string {
  const candidates = [
    process.env.CLAUDE_PATH,
    "claude", // PATH経由
  ];

  // nvmのパスを動的に検出
  const nvmDir = process.env.NVM_DIR || path.join(HOME, ".nvm");
  if (fs.existsSync(nvmDir)) {
    const versionsDir = path.join(nvmDir, "versions", "node");
    if (fs.existsSync(versionsDir)) {
      const versions = fs.readdirSync(versionsDir).sort().reverse();
      for (const version of versions) {
        candidates.push(path.join(versionsDir, version, "bin", "claude"));
      }
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === "claude") return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }

  return "claude";
}

const CLAUDE_PATH = findClaudePath();
console.log(`🤖 claudeパス: ${CLAUDE_PATH}`);

function loadState(): string {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      if (data.currentDir && fs.existsSync(data.currentDir)) {
        console.log(`📁 前回のディレクトリを復元: ${data.currentDir}`);
        return data.currentDir;
      }
    }
  } catch {}
  return path.resolve(process.env.OUTPUT_DIR || HOME);
}

function saveState(dir: string): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ currentDir: dir }, null, 2));
  } catch {}
}

let lastTimestamp: string | null = null;
let currentDir = loadState();

function resolvePath(p: string): string {
  return p.replace(/`/g, "").replace(/^~/, HOME).trim();
}

function listDir(targetPath: string): string {
  if (!fs.existsSync(targetPath)) {
    return `❌ ディレクトリが存在しません: \`${targetPath}\``;
  }
  const items = fs.readdirSync(targetPath, { withFileTypes: true });
  const dirs = items.filter(i => i.isDirectory()).map(i => `📁 ${i.name}`);
  const files = items.filter(i => !i.isDirectory()).map(i => `📄 ${i.name}`);
  const all = [...dirs, ...files];
  if (all.length === 0) return `📂 空のディレクトリです: \`${targetPath}\``;
  return `📂 \`${targetPath}\`\n\n${all.join("\n")}`;
}

async function postToSlack(text: string): Promise<void> {
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: CHANNEL_ID, text }),
  });
}

async function fetchLatestMessages(): Promise<any[]> {
  const params: Record<string, string> = {
    channel: CHANNEL_ID,
    limit: "10",
  };
  if (lastTimestamp) {
    params.oldest = lastTimestamp;
  }

  const res = await fetch(
    `https://slack.com/api/conversations.history?${new URLSearchParams(params)}`,
    { headers: { Authorization: `Bearer ${SLACK_TOKEN}` } }
  );
  const data = (await res.json()) as any;

  if (!data.ok) {
    console.error("Slack API error:", data.error);
    return [];
  }

  return (data.messages || []).reverse();
}

function runClaudeCode(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    let output = "";
    let lastReport = Date.now();
    let buffer = "";

    const proc = spawn(
      CLAUDE_PATH,
      ["--print", "--dangerously-skip-permissions"],
      { cwd: currentDir, env: process.env, shell: CLAUDE_PATH === "claude" }
    );

    proc.stdin.write(prompt);
    proc.stdin.end();

    const reportProgress = async (text: string) => {
      const lines = text.split("\n").filter(l => l.trim()).slice(-3).join("\n");
      if (lines) {
        await postToSlack(`⚙️ 作業中...\n\`\`\`\n${lines.slice(0, 500)}\n\`\`\``);
      }
    };

    proc.stdout.on("data", async (data: Buffer) => {
      const text = data.toString();
      output += text;
      buffer += text;
      console.log(text);

      const now = Date.now();
      if (now - lastReport > 30000) {
        lastReport = now;
        await reportProgress(buffer);
        buffer = "";
      }
    });

    proc.stderr.on("data", (data: Buffer) => {
      console.error(data.toString());
    });

    proc.on("close", () => {
      resolve(output.trim());
    });

    proc.on("error", (err) => {
      resolve(`エラーが発生しました: ${err.message}`);
    });
  });
}

async function poll(): Promise<void> {
  console.log("📡 Slackのポーリングを開始します...");
  console.log(`チャンネルID: ${CHANNEL_ID}`);
  console.log(`ポーリング間隔: ${POLL_INTERVAL_MS}ms`);
  console.log(`作業ディレクトリ: ${currentDir}\n`);

  if (!fs.existsSync(currentDir)) {
    fs.mkdirSync(currentDir, { recursive: true });
  }

  lastTimestamp = (Date.now() / 1000).toString();

  while (true) {
    try {
      const messages = await fetchLatestMessages();

      for (const msg of messages) {
        if (msg.bot_id || msg.subtype) continue;

        const text = msg.text?.trim();
        if (!text) continue;

        lastTimestamp = msg.ts;

        // .h / .help → コマンド一覧を表示
        if (text === ".h" || text === ".help") {
          await postToSlack(`📖 *コマンド一覧*

*.claude <指示>* — Claude Codeに指示を出す
例: \`.claude Reactのコンポーネントを作って\`

*.read <ファイル> [ページ]* — ファイルの中身を表示
例: \`.read README.md\` \`.read README.md 2\`

*.ls [パス]* — ディレクトリ一覧を表示
例: \`.ls\` \`.ls ~/Desktop\`

*.cd <パス>* — ディレクトリを移動
例: \`.cd my-project\` \`.cd ..\` \`.cd ~/Desktop\`

*.pwd* — 現在のディレクトリを表示

*.h / .help* — このヘルプを表示`);
          continue;
        }

        // .pwd → 現在のディレクトリを表示
        if (text === ".pwd") {
          await postToSlack(`📁 現在の作業ディレクトリ:\n\`${currentDir}\``);
          continue;
        }

        // .ls [path] → ディレクトリ一覧
        if (text === ".ls" || text.startsWith(".ls ")) {
          const targetPath = text === ".ls"
            ? currentDir
            : resolvePath(text.replace(/^\.ls\s+/, "").trim());
          const result = listDir(targetPath);
          await postToSlack(result);
          continue;
        }

        // .read <file> [page] → ファイルの中身を表示
        if (text.startsWith(".read ")) {
          const parts = resolvePath(text.replace(/^\.read\s+/, "").trim()).split(/\s+/);
          const fileName = parts[0];
          const page = parseInt(parts[1] || "1");
          const filePath = path.isAbsolute(fileName)
            ? fileName
            : path.resolve(currentDir, fileName);
          if (!fs.existsSync(filePath)) {
            await postToSlack(`❌ ファイルが存在しません: \`${filePath}\``);
            continue;
          }
          const content = fs.readFileSync(filePath, "utf8");
          const maxLength = 2900;
          const totalPages = Math.ceil(content.length / maxLength);
          const start = (page - 1) * maxLength;
          const chunk = content.slice(start, start + maxLength);
          if (!chunk) {
            await postToSlack(`❌ ページ ${page} は存在しません（全${totalPages}ページ）`);
            continue;
          }
          await postToSlack(`📄 \`${fileName}\` (${page}/${totalPages}ページ)\n\`\`\`\n${chunk}\n\`\`\``);
          continue;
        }

        // .cd <path> → ディレクトリ移動
        if (text.startsWith(".cd")) {
          const arg = resolvePath(text.replace(/^\.cd\s*/, "").trim());
          if (!arg) {
            await postToSlack(`📁 現在の作業ディレクトリ:\n\`${currentDir}\``);
            continue;
          }
          const newDir = arg === ".."
            ? path.dirname(currentDir)
            : path.isAbsolute(arg)
              ? arg
              : path.resolve(currentDir, arg);

          if (!fs.existsSync(newDir)) {
            await postToSlack(`❌ ディレクトリが存在しません: \`${newDir}\``);
            continue;
          }
          currentDir = newDir;
          saveState(currentDir);
          console.log(`📁 作業ディレクトリを変更: ${currentDir}`);
          const result = listDir(currentDir);
          await postToSlack(`✅ 移動しました！\n\n${result}`);
          continue;
        }

        // .claude <prompt> → Claude Codeを実行
        if (text.startsWith(".claude")) {
          const prompt = text.replace(/^\.claude\s*/, "").trim();
          if (!prompt) continue;

          console.log(`✉️  新しい指示: ${prompt}`);
          await postToSlack(`⏳ 承りました！\n*指示:* ${prompt}\n*作業ディレクトリ:* \`${currentDir}\`\n\nClaude Codeが作業中です...`);

          const result = await runClaudeCode(prompt);

          const maxLength = 2900;
          const reply = result.length > maxLength
            ? result.slice(0, maxLength) + "\n\n...(省略されました)"
            : result;

          await postToSlack(`✅ 完了しました！\n\`\`\`\n${reply}\n\`\`\``);
          console.log("✅ 完了！結果をSlackに送信しました。");
          continue;
        }
      }

      if (messages.length > 0) {
        const latest = messages[messages.length - 1];
        if (latest.ts) lastTimestamp = latest.ts;
      }
    } catch (err) {
      console.error("ポーリングエラー:", err);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

poll();