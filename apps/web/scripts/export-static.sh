#!/usr/bin/env bash
# Static, auth-free build of the current snapshot for offline review (out/).
# Server-only routes (SSO, middleware, sign-in) are set aside for the build.
set -euo pipefail
cd "$(dirname "$0")/.."
stash=$(mktemp -d)
mv middleware.ts "$stash/" ; mv app/api "$stash/api" ; mv app/signin "$stash/signin"
restore() { mv "$stash/middleware.ts" . ; mv "$stash/api" app/api ; mv "$stash/signin" app/signin ; }
trap restore EXIT
PDT_STATIC_EXPORT=1 npx next build
echo "Static site in apps/web/out"
