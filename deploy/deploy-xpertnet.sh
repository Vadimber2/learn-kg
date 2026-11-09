#!/usr/bin/env bash
# Редеплой kyrgyz-a1-m0 на Coolify xpertnet (деплой из GitHub Vadimber2/kyrgyz-a1).
# Обновление: правки → git push → ./deploy-xpertnet.sh (или вебхук сам задеплоит).
# Токен: ~/.config/coolify/xpertnet.token или env COOLIFY_TOKEN.
set -euo pipefail
BASE="https://coolify.xpertnet.ai/api/v1"
TOKEN="${COOLIFY_TOKEN:-$(cat ~/.config/coolify/xpertnet.token 2>/dev/null || true)}"
[ -n "$TOKEN" ] || { echo "Нет токена (~/.config/coolify/xpertnet.token или COOLIFY_TOKEN)"; exit 1; }
APP_UUID="${1:-$(cat "$(dirname "$0")/app-uuid" 2>/dev/null || true)}"
[ -n "$APP_UUID" ] || { echo "Нет uuid приложения (файл deploy/app-uuid или аргумент)"; exit 1; }
# Проверка CVE перед каждым деплоем (тот же хук, что у coolify_deploy в Claude Code):
# Node в Dockerfile origin/main закреплён, без вышедшего патча безопасности, линия в поддержке.
node "$(dirname "$0")/../.claude/hooks/pre-deploy-cve.js" --check || { echo "Деплой остановлен проверкой CVE"; exit 2; }
curl -sS -X POST "$BASE/deploy?uuid=$APP_UUID" -H "Authorization: Bearer $TOKEN"
echo ""
