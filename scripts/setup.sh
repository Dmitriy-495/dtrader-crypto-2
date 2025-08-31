# ===== Скрипт для первого запуска (scripts/setup.sh) =====
#!/bin/bash

echo "🚀 Настройка dtrader-crypto 2.0..."

# Создание директории логов
if [ ! -d "logs" ]; then
    mkdir -p logs
    touch logs/.gitkeep
    echo "✅ Создана директория logs"
fi

# Копирование .env файла
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Создан файл .env из .env.example"
    echo "⚠️  Не забудьте настроить API ключи в .env файле!"
else
    echo "ℹ️  Файл .env уже существует"
fi

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install

# Проверка TypeScript
echo "🔍 Проверка TypeScript..."
npm run typecheck

echo "🎉 Настройка завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Настройте API ключи в файле .env"
echo "2. Запустите в режиме разработки: npm run dev"
echo "3. Или соберите и запустите: npm run prod"
echo ""
echo "📖 Полезные команды:"
echo "  npm run dev          - Запуск в режиме разработки"
echo "  npm run logs:tail    - Просмотр логов в реальном времени"
echo "  npm run test         - Запуск тестов"
echo "  npm run lint         - Проверка кода"
