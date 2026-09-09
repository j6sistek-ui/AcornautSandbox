#!/bin/sh
cd "$(dirname "$0")" || exit 1
exec node tools/flight-studio/launch.mjs "$@"
