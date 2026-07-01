#!/bin/sh
set -e

python manage.py migrate --noinput

if [ "${DEMO_SEED:-0}" = "1" ] || [ "${DEMO_SEED:-0}" = "True" ]; then
  if python manage.py help seed_demo >/dev/null 2>&1; then
    python manage.py seed_demo
  else
    echo "seed_demo command not available yet — skipping."
  fi
fi

exec python manage.py runserver 0.0.0.0:8000
