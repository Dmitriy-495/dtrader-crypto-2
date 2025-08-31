#!/usr/bin/env node

import { EventBus, eventBus } from './core/EventBus';
import { TerminalManager } from './core/TerminalManager';

/**
 * Интерфейс конфигурации приложения
 */
interface AppConfig {
    name: string;
    version: string;
    environment: string;
}

/**
 * Основной класс торгового бота dtrader-crypto 2.0
 */
class DTraderCrypto {
    private readonly config: AppConfig;
    private readonly eventBus: EventBus;
    private readonly terminalManager: TerminalManager;
    private isRunning: boolean = false;

    constructor(eventBus: EventBus) {
        this.eventBus = eventBus;
        this.config = {
            name: 'dtrader-crypto 2.0',
            version: process.env.npm_package_version || '2.0.0',
            environment: process.env.NODE_ENV || 'development',
        };

        // Инициализация терминального менеджера
        this.terminalManager = new TerminalManager(this.eventBus, {
            colors: process.env.TERMINAL_COLORS !== 'false',
            unicode: process.env.TERMINAL_UNICODE !== 'false',
            grabInput: true,
            mouse: false,
        });

        this.setupEventListeners();
        this.setupProcessHandlers();
    }

    /**
     * Настройка слушателей событий
     */
    private setupEventListeners(): void {
        this.eventBus.onTyped('app:start', this.handleAppStart.bind(this));
        this.eventBus.onTyped('app:stop', this.handleAppStop.bind(this));
        this.eventBus.onTyped('app:error', this.handleAppError.bind(this));
        this.eventBus.onTyped('terminal:exit', this.handleExit.bind(this));
        this.eventBus.onTyped(
            'terminal:key',
            this.handleTerminalKey.bind(this)
        );
        this.eventBus.onTyped(
            'terminal:resize',
            this.handleTerminalResize.bind(this)
        );
    }

    /**
     * Настройка обработчиков процесса
     */
    private setupProcessHandlers(): void {
        // Обработка сигналов завершения
        process.on('SIGINT', () => {
            this.eventBus.emitTyped('terminal:exit');
        });

        process.on('SIGTERM', () => {
            this.eventBus.emitTyped('terminal:exit');
        });

        // Обработка необработанных исключений
        process.on('uncaughtException', (error: Error) => {
            this.terminalManager.showError('Необработанная ошибка', error);
            this.gracefulShutdown();
        });

        process.on('unhandledRejection', (reason: unknown) => {
            const error =
                reason instanceof Error ? reason : new Error(String(reason));
            this.terminalManager.showError(
                'Необработанное отклонение Promise',
                error
            );
            this.gracefulShutdown();
        });
    }

    /**
     * Обработка запуска приложения
     */
    private handleAppStart(): void {
        this.isRunning = true;
        this.terminalManager.showInfo('Приложение успешно запущено');
    }

    /**
     * Обработка остановки приложения
     */
    private handleAppStop(): void {
        this.isRunning = false;
        this.terminalManager.showInfo('Остановка торгового бота...');
    }

    /**
     * Обработка ошибок приложения
     */
    private handleAppError(error: Error): void {
        this.terminalManager.showError('Ошибка приложения', error);
    }

    /**
     * Обработка выхода
     */
    private handleExit(): void {
        this.gracefulShutdown();
    }

    /**
     * Обработка нажатий клавиш
     */
    private handleTerminalKey(keyName: string, data: any): void {
        // Здесь можно добавить обработку специфичных команд бота
        // Пока просто логируем в режиме разработки
        if (this.config.environment === 'development') {
            // Логирование уже происходит в TerminalManager
        }
    }

    /**
     * Обработка изменения размера терминала
     */
    private handleTerminalResize(width: number, height: number): void {
        if (this.config.environment === 'development') {
            this.terminalManager.showInfo(
                `Размер терминала изменен: ${width}x${height}`
            );
        }
    }

    /**
     * Корректное завершение работы
     */
    private gracefulShutdown(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        // Отправка события остановки
        this.eventBus.emitTyped('app:stop');

        // Завершение работы терминала
        this.terminalManager.gracefulShutdown();

        // Очистка Event Bus
        this.eventBus.cleanup();
    }

    /**
     * Запуск приложения
     */
    public start(): void {
        try {
            this.terminalManager.showInfo(`Запуск ${this.config.name}...`);
            this.eventBus.emitTyped('app:start');
        } catch (error) {
            const err =
                error instanceof Error ? error : new Error(String(error));
            this.eventBus.emitTyped('app:error', err);
        }
    }

    /**
     * Получение конфигурации приложения
     */
    public getConfig(): AppConfig {
        return { ...this.config };
    }

    /**
     * Проверка состояния приложения
     */
    public isAppRunning(): boolean {
        return this.isRunning;
    }
}

/**
 * Основная функция запуска приложения
 */
async function main(): Promise<void> {
    try {
        const app = new DTraderCrypto(eventBus);
        app.start();
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('❌ Критическая ошибка при запуске:', err.message);

        if (process.env.NODE_ENV === 'development') {
            console.error('📋 Стек ошибки:', err.stack);
        }

        process.exit(1);
    }
}

// Запуск приложения только при прямом выполнении файла
if (require.main === module) {
    main().catch((error) => {
        console.error('💥 Фатальная ошибка:', error);
        process.exit(1);
    });
}

// Экспорт для возможного использования как модуля
export { DTraderCrypto, EventBus, TerminalManager };
