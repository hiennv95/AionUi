#!/bin/zsh
# Stop and remove the AionX host launchd agent. Data and logs under ~/.aionx-host are kept.
set -euo pipefail

LABEL=com.aionx.host
launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
print "removed $LABEL (data kept in ~/.aionx-host)"
