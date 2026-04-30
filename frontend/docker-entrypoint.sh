#!/bin/sh
set -e

cat <<EOF > /app/public/runtime-config.js
window.__RUNTIME_CONFIG__ = {
  API_URL: "${NEXT_PUBLIC_API_URL}"
};
EOF

exec "$@"
