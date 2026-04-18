#!/bin/sh
set -e
APP_DIR='/opt/AiJIN OS Switcher'
EXAMPLE="${APP_DIR}/os-switch.config.example.json"
DOC_DIR='/usr/share/doc/appswit'

mkdir -p "$DOC_DIR"

if [ -f "$EXAMPLE" ]; then
  cp -f "$EXAMPLE" "$DOC_DIR/os-switch.config.example.json"
fi
