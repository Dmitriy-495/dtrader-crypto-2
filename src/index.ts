#!/usr/bin/env node

import 'dotenv/config'; // ДОБАВЛЕНО: Загрузка переменных окружения
import { EventBus, eventBus } from './core/EventBus';
import { TerminalManager } from './core/TerminalManager';
import { logger, createTimer } from './utils/Logger';

interface AppConfig {
    name: string;
    version: string;
    environment: string;
}

export class DTraderCrypto {
    private readonly config: AppConfig;
    private readonly eventBus: EventBus;
    private readonly terminalManager: TerminalManager;
    private readonly appLogger = logger.child({ module: 'app' });
    private isRunning: boolean = false;
    private startTime?: ReturnType<typeof createTimer>;

    constructor(eventBus: EventBus) {
        this.eventBus = eventBus;
        this.config = {
            name: 'dtrader-crypto 2.0',
            version: process.env.npm_package_version || '2.0.0',
            environment: process.env.NODE_ENV || 'development',
        };

        this.appLogger.info('Создание экземпляра DTraderCrypto', {
            config: this.config,
        });

        this.terminalManager = new TerminalManager(this.eventBus, {
            colors: process.env.TERMINAL_COLORS !== 'false',
            unicode: process.env.TERMINAL_UNICODE !== 'false',
            grabInput: true,
            mouse: false,
        });

        this.setupEventListeners();
        this.setupProcessHandlers();
    }

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

        this.appLogger.debug('Event listeners настроены');
    }

    private setupProcessHandlers(): void {
        process.on('SIGINT', () => {
            this.appLogger.warn('Получен сигнал SIGINT');
            this.eventBus.emitTyped('terminal:exit');
        });

        process.on('SIGTERM', () => {
            this.appLogger.warn('Получен сигнал SIGTERM');
            this.eventBus.emitTyped('terminal:exit');
        });

        process.on('uncaughtException', (error: Error) => {
            this.appLogger.error('Необработанное исключение', {
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                },
            });
            this.terminalManager.showError('Необработанная ошибка', error);
            this.gracefulShutdown();
        });

        process.on(
            'unhandledRejection',
            (reason: unknown, promise: Promise<any>) => {
                this.appLogger.error('Необработанное отклонение Promise', {
                    reason: String(reason),
                    promise: promise.toString(),
                });
                this.terminalManager.showError(
                    'Необработанное отклонение Promise',
                    reason instanceof Error ? reason : new Error(String(reason))
                );
                this.gracefulShutdown();
            }
        );

        this.appLogger.debug('Process handlers настроены');
    }

    private handleAppStart(): void {
        this.startTime = createTimer();
        this.isRunning = true;
        this.appLogger.info('Приложение запущено');
        this.terminalManager.showInfo('Приложение успешно запущено');
    }

    private handleAppStop(): void {
        const duration = this.startTime ? this.startTime() : 0;
        this.isRunning = false;

        this.appLogger.info('Приложение остановлено', {
            uptime: duration,
            sessionId: this.terminalManager.getSessionInfo().id,
        });

        this.terminalManager.showInfo('Остановка торгового бота...');
    }

    private handleAppError(error: Error): void {
        this.appLogger.errorWithContext(error, 'Ошибка приложения');
        this.terminalManager.showError('Ошибка приложения', error);
    }

    private handleExit(): void {
        this.appLogger.info('Обработка выхода из приложения');
        this.gracefulShutdown();
    }

    private handleTerminalKey(keyName: string, data: any): void {
        this.appLogger.debug('Обработка нажатия клавиши', {
            keyName,
            environment: this.config.environment,
        });
    }

    private handleTerminalResize(width: number, height: number): void {
        this.appLogger.debug('Изменение размера терминала', { width, height });

        if (this.config.environment === 'development') {
            this.terminalManager.showInfo(
                `Размер терминала изменен: ${width}x${height}`
            );
        }
    }

    private gracefulShutdown(): void {
        if (!this.isRunning) {
            this.appLogger.warn(
                'Попытка завершения уже остановленного приложения'
            );
            return;
        }

        const shutdownTimer = createTimer();
        this.isRunning = false;

        this.appLogger.info('Начало корректного завершения работы');

        // Отправка события остановки
        this.eventBus.emitTyped('app:stop');

        // Завершение работы терминала
        this.terminalManager.gracefulShutdown();

        // Очистка Event Bus
        this.eventBus.cleanup();

        const shutdownDuration = shutdownTimer();
        this.appLogger.info('Корректное завершение завершено', {
            duration: shutdownDuration,
        });
    }

    public start(): void {
        try {
            this.appLogger.info(`Запуск ${this.config.name}`, {
                version: this.config.version,
                environment: this.config.environment,
                nodeVersion: process.version,
            });

            this.terminalManager.showInfo(`Запуск ${this.config.name}...`);
            this.eventBus.emitTyped('app:start');
        } catch (error) {
            const err =
                error instanceof Error ? error : new Error(String(error));
            this.appLogger.errorWithContext(
                err,
                'Ошибка при запуске приложения'
            );
            this.eventBus.emitTyped('app:error', err);
        }
    }

    public getConfig(): AppConfig {
        return { ...this.config };
    }

    public isAppRunning(): boolean {
        return this.isRunning;
    }
}

async function main(): Promise<void> {
    const mainTimer = createTimer();

    try {
        logger.info('='.repeat(60));
        logger.info('Запуск dtrader-crypto 2.0', {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
        });
        logger.info('='.repeat(60));

        // Валидация окружения
        const requiredEnvVars = ['GATE_API_KEY', 'GATE_SECRET_KEY'];
        const missingVars = requiredEnvVars.filter(
            (varName) => !process.env[varName]
        );

        if (missingVars.length > 0) {
            throw new Error(
                `Отсутствуют обязательные переменные окружения: ${missingVars.join(', ')}`
            );
        }

        logger.info('Валидация переменных окружения пройдена');

        const app = new DTraderCrypto(eventBus);
        app.start();

        const startupDuration = mainTimer();
        logger.info('Приложение успешно запущено', {
            startupTime: startupDuration,
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const startupDuration = mainTimer();

        logger.error('Критическая ошибка при запуске', {
            error: {
                name: err.name,
                message: err.message,
                stack: err.stack,
            },
            startupTime: startupDuration,
        });

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
        logger.error('Фатальная ошибка', {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
        });
        console.error('💥 Фатальная ошибка:', error);
        process.exit(1);
    });
}

export { EventBus, TerminalManager };
