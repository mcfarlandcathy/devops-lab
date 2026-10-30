#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

ENV_FILE="$PROJECT_DIR/.env.ghcr"
COMPOSE=(docker compose --env-file "$PROJECT_DIR/.env" --env-file "$ENV_FILE" -p devops-lab -f "$PROJECT_DIR/compose.ghcr.yml")

NEW_VERSION="${1:-}"

if [[ ! "$NEW_VERSION" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Использование: $0 <полный-SHA-коммита>"
    exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Не найден файл .env.ghcr"
    exit 1
fi

OLD_VERSION="$(sed -n 's/^APP_VERSION=//p' "$ENV_FILE" | tail -n 1)"

if [[ ! "$OLD_VERSION" =~ ^[0-9a-f]{40}$ ]]; then
    echo "В .env.ghcr не найдена корректная предыдущая версия."
    exit 1
fi

set_version() {
    local version="$1"
    if grep -q '^APP_VERSION=' "$ENV_FILE"; then
        sed -i "s/^APP_VERSION=.*/APP_VERSION=$version/" "$ENV_FILE"
    else
        printf '\nAPP_VERSION=%s\n' "$version" >> "$ENV_FILE"
    fi
}

rollback() {
    echo "Откатываемся на $OLD_VERSION..."

    set_version "$OLD_VERSION"

    if ! sudo "${COMPOSE[@]}" pull app frontend; then
        echo "ОШИБКА: не удалось скачать предыдущие образы."
        return 1
    fi

    if ! sudo "${COMPOSE[@]}" up -d --no-deps app frontend; then
        echo "ОШИБКА: не удалось запустить предыдущую версию."
        return 1
    fi

    for attempt in {1..30}; do
        if curl -fsS http://localhost:3000/health >/dev/null \
            && curl -fsS http://localhost:8080/ >/dev/null; then
            echo "Откат успешен. Восстановлена версия: $OLD_VERSION"
            return 0
        fi

        sleep 2
    done

    echo "ОШИБКА: предыдущая версия не прошла проверку."
    return 1
}

echo "Обновляемся с $OLD_VERSION на $NEW_VERSION..."

set_version "$NEW_VERSION"

if ! sudo "${COMPOSE[@]}" pull app frontend; then
    echo "Не удалось скачать образы. Возвращаем предыдущую версию."
    set_version "$OLD_VERSION"
    exit 1
fi

if ! sudo "${COMPOSE[@]}" up -d --no-deps app frontend; then
    echo "Не удалось запустить новую версию."
    rollback
    exit 1
fi

echo "Проверяем API и frontend..."

for attempt in {1..30}; do
    if [[ "${FORCE_DEPLOY_FAILURE:-0}" != "1" ]] \
        && curl -fsS http://localhost:3000/health >/dev/null \
        && curl -fsS http://localhost:8080/ >/dev/null; then
        echo "Обновление успешно. Активная версия: $NEW_VERSION"
        exit 0
    fi

    sleep 2
done

echo "Проверка не пройдена."

if rollback; then
    exit 1
else
    echo "ВНИМАНИЕ: автоматический откат не завершился."
    exit 2
fi