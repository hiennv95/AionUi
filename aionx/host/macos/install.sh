#!/bin/zsh
# Install (or reinstall) the AionX host as a per-user launchd agent.
# Usage: host/macos/install.sh [--app-dir DIR] [--data-dir DIR] [--port N]
set -euo pipefail

LABEL=com.aionx.host
SCRIPT_DIR=${0:A:h}
APP_DIR=${SCRIPT_DIR:h:h:h}  # repo root (aionx/host/macos → ../../..)
DATA_DIR=$HOME/.aionx-host/data
PORT=25818
NODE_BIN=$HOME/.nvm/versions/node/v24.22.1/bin

while (( $# )); do
  case $1 in
    --app-dir) APP_DIR=${2:A}; shift 2 ;;
    --data-dir) DATA_DIR=${2:A}; shift 2 ;;
    --port) PORT=$2; shift 2 ;;
    *) print -u2 "unknown option: $1"; exit 64 ;;
  esac
done

# Fail early instead of letting launchd crash-loop on a missing prerequisite.
for required in "$HOME/.bun/bin/bun" "$NODE_BIN/node" "$APP_DIR/scripts/webui.ts" \
  "$APP_DIR/out/renderer/index.html" "$APP_DIR/resources/bundled-aioncore/darwin-arm64/aioncore"; do
  [[ -e $required ]] || { print -u2 "missing prerequisite: $required"; exit 66; }
done
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && ! launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  print -u2 "port $PORT is already in use by another process"; exit 69
fi

mkdir -p "$DATA_DIR" "${DATA_DIR:h}/logs" "$HOME/Library/LaunchAgents"
chmod 700 "${DATA_DIR:h}"

PLIST=$HOME/Library/LaunchAgents/$LABEL.plist
sed -e "s#__HOME__#$HOME#g" -e "s#__APP_DIR__#$APP_DIR#g" -e "s#__DATA_DIR__#$DATA_DIR#g" \
  -e "s#__PORT__#$PORT#g" -e "s#__NODE_BIN__#$NODE_BIN#g" \
  "$SCRIPT_DIR/$LABEL.plist.template" > "$PLIST"
plutil -lint "$PLIST" >/dev/null

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$PLIST"
print "installed $LABEL → http://127.0.0.1:$PORT (logs: ${DATA_DIR:h}/logs)"
