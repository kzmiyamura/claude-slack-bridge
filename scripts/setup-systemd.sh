#!/bin/bash
set -e

# ============================================================
# setup-systemd.sh — Auto-start claude-slack-bridge on Linux
# ============================================================

SERVICE_NAME="claude-slack-bridge"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_FILE="$HOME/.config/systemd/user/${SERVICE_NAME}.service"

echo "==> claude-slack-bridge systemd setup"
echo "    Project dir : $PROJECT_DIR"
echo "    User        : $USER"

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

  # 3. Common install paths
  for candidate in /usr/local/bin/node /usr/bin/node; do
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

# ---------- Generate service file ----------
echo "==> Generating service file: $SERVICE_FILE"
mkdir -p "$(dirname "$SERVICE_FILE")"
mkdir -p "$PROJECT_DIR/logs"

cat > "$SERVICE_FILE" <<SERVICE
[Unit]
Description=claude-slack-bridge — Control Claude Code from Slack
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${PROJECT_DIR}
ExecStart=${NODE_PATH} ${PROJECT_DIR}/dist/index.js
Restart=always
RestartSec=5

Environment=PATH=${NODE_BIN_DIR}:/usr/local/bin:/usr/bin:/bin
StandardOutput=append:${PROJECT_DIR}/logs/stdout.log
StandardError=append:${PROJECT_DIR}/logs/stderr.log

[Install]
WantedBy=default.target
SERVICE

# ---------- Enable & start ----------
echo "==> Enabling and starting systemd user service..."
systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME"
systemctl --user start  "$SERVICE_NAME"

# Enable lingering so the service starts without login
if command -v loginctl &>/dev/null; then
  loginctl enable-linger "$USER" 2>/dev/null || true
fi

echo ""
echo "Done! The bot is running and will start on every boot."
echo ""
echo "Useful commands:"
echo "  Check status : systemctl --user status $SERVICE_NAME"
echo "  Stop         : systemctl --user stop    $SERVICE_NAME"
echo "  Start        : systemctl --user start   $SERVICE_NAME"
echo "  Logs         : journalctl --user -u $SERVICE_NAME -f"
echo "               : tail -f $PROJECT_DIR/logs/stdout.log"
