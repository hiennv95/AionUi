#!/bin/zsh
# Install (or reinstall) the AionX host as a per-user launchd agent.
# aioncore serves the API and the web client directly; no Node runtime (ADR-002).
#
# Usage: aionx/host/macos/install.sh [--aioncore BIN] [--static-dir DIR] [--data-dir DIR] [--port N]
#   --aioncore    aioncore binary with --static-dir support (copied to ~/.aionx-host/bin)
#   --static-dir  built web client (contains index.html); default: this repo's out/renderer
set -euo pipefail

LABEL=com.aionx.host
SCRIPT_DIR=${0:A:h}
APP_DIR=${SCRIPT_DIR:h:h:h}  # repo root (aionx/host/macos → ../../..)
HOST_DIR=$HOME/.aionx-host
AIONCORE_SRC=${APP_DIR:h}/AionCore/target/release/aioncore
STATIC_DIR=$APP_DIR/out/renderer
DATA_DIR=$HOST_DIR/data
PORT=25818

while (( $# )); do
  case $1 in
    --aioncore) AIONCORE_SRC=${2:A}; shift 2 ;;
    --static-dir) STATIC_DIR=${2:A}; shift 2 ;;
    --data-dir) DATA_DIR=${2:A}; shift 2 ;;
    --port) PORT=$2; shift 2 ;;
    *) print -u2 "unknown option: $1"; exit 64 ;;
  esac
done

# Fail early instead of letting launchd crash-loop on a missing prerequisite.
[[ -x $AIONCORE_SRC ]] || { print -u2 "missing aioncore binary: $AIONCORE_SRC"; exit 66; }
"$AIONCORE_SRC" --help | grep -q -- '--static-dir' \
  || { print -u2 "aioncore at $AIONCORE_SRC lacks --static-dir (needs AionCore feat/static-dir)"; exit 66; }
[[ -f $STATIC_DIR/index.html ]] || { print -u2 "missing web client: $STATIC_DIR/index.html"; exit 66; }
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && ! launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  print -u2 "port $PORT is already in use by another process"; exit 69
fi

mkdir -p "$DATA_DIR" "$HOST_DIR/logs" "$HOST_DIR/bin" "$HOME/Library/LaunchAgents"
chmod 700 "$HOST_DIR"

# Stop the old agent before replacing the binary it may be running.
launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
install -m 755 "$AIONCORE_SRC" "$HOST_DIR/bin/aioncore"

PLIST=$HOME/Library/LaunchAgents/$LABEL.plist
sed -e "s#__HOME__#$HOME#g" -e "s#__AIONCORE__#$HOST_DIR/bin/aioncore#g" -e "s#__STATIC_DIR__#$STATIC_DIR#g" \
  -e "s#__DATA_DIR__#$DATA_DIR#g" -e "s#__PORT__#$PORT#g" \
  "$SCRIPT_DIR/$LABEL.plist.template" > "$PLIST"
plutil -lint "$PLIST" >/dev/null

# bootout is asynchronous; retry bootstrap briefly while the old job drains.
for attempt in 1 2 3 4 5; do
  launchctl bootstrap "gui/$UID" "$PLIST" 2>/dev/null && break
  (( attempt == 5 )) && { print -u2 "launchctl bootstrap failed"; exit 70; }
  sleep 2
done
print "installed $LABEL → http://127.0.0.1:$PORT (logs: $HOST_DIR/logs)"
