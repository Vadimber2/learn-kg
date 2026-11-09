# Кыргызтест A1 — статик + basic auth + прогресс в JSON-файлах (без БД).
# Учётные данные: server/users.json (статика), см. deploy/CREDENTIALS.md.
# Версия Node закреплена: плавающий тег из кэша сборщика оставлял прод на уязвимой
# сборке. 22.23.4 закрывает CVE октября 2026 (Brotli OOB write, TLS hostname bypass,
# keep-alive, dns NUL; https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).
# Digest закрепляет сам образ (тег в реестре изменяем). Следующий патч безопасности — правкой
# этой строки вместе с digest (`docker buildx imagetools inspect node:<версия>-alpine`), тега
# в CI (.github/workflows/ci.yml) и в командах докер-прогона (CLAUDE.md, module-checklist.md).
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
WORKDIR /srv
COPY package.json ./
COPY app ./app
COPY server ./server
# реестр голосов: сервер берёт из него голос курса по умолчанию (male_adult)
COPY deploy/voices.json ./deploy/voices.json
ENV PORT=80 DATA_DIR=/data
EXPOSE 80
CMD ["node", "server/server.js"]
