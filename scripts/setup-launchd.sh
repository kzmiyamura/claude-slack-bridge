#!/bin/bash
set -e

# ============================================================
# setup-launchd.sh — Auto-start claude-slack-bridge on macOS
# ============================================================

LABEL="com.claude-slack-bridge"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

echo "==> claude-slack-bridge launchd setup"
echo "    Project dir : $PROJECT_DIR"

# ---------- Detect node ----------
detect_node() {
  # 1. Current PATH
  if command -v node &>/dev/null; then
    echo "$(command -v node)"
    return
  fi

  # 2. nvm
  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -d "$nvm_dir/versions/node" ]; then
    local ver
    ver=$(ls "$nvm_dir/versions/node" | sort -V | tail -1)
    if [ -n "$ver" ] && [ -x "$nvm_dir/versions/node/$ver/bin/node" ]; then
      echo "$nvm_dir/versions/node/$ver/bin/node"
      return
    fi
  fi

  # 3. Homebrew (Apple Silicon / Intel)
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    [ -x "$candidate" ] && echo "$candidate" && return
  done

  echo ""
}

NODE_PATH="$(detect_node)"
if [ -z "$NODE_PATH" ]; then
  echo "ERROR: node not found. Install Node.js v20+ and re-run."
  exit 1
fi
NODE_BIN_DIR="$(dirname "$NODE_PATH")"
echo "    Node        : $NODE_PATH"

# ---------- Build ----------
echo "==> Building TypeScript..."
cd "$PROJECT_DIR"
"$NODE_BIN_DIR/npm" run build

# ---------- Generate plist ----------
echo "==> Generating plist: $PLIST_PATH"
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$PROJECT_DIR/logs"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${PROJECT_DIR}/dist/index.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${NODE_BIN_DIR}:/usr/local/bin:/usr/bin:/bin</string>
  </dict>

  <key>StandardOutPath</key>
  <string>${PROJECT_DIR}/logs/stdout.log</string>

  <key>StandardErrorPath</key>
  <string>${PROJECT_DIR}/logs/stderr.log</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
PLIST

# ---------- Load / reload ----------
echo "==> Registering with launchctl..."
if launchctl list | grep -q "$LABEL" 2>/dev/null; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi
launchctl load "$PLIST_PATH"

echo ""
echo "Done! The bot will start now and on every login."
echo ""
echo "Useful commands:"
echo "  Check status : launchctl list | grep $LABEL"
echo "  Stop         : launchctl unload $PLIST_PATH"
echo "  Start        : launchctl load   $PLIST_PATH"
echo "  Logs         : tail -f $PROJECT_DIR/logs/stdout.log"
