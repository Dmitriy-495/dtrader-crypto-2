// src/utils/Logger.ts
import winston from 'winston';
import { format } from 'date-fns';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Уровни логирования
 */
export enum LogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    HTTP = 'http',
    VERBOSE = 'verbose',
    DEBUG = 'debug',
    SILLY = 'silly',
}

/**
 * Конфигурация логгера
 */
export interface LoggerConfig {
    level: string;
    logDir: string;
    maxFiles: number;
    maxSize: string;
    datePattern: string;
    enableConsole: boolean;
    enableFile: boolean;
    enableErrorFile: boolean;
    colorize: boolean;
    maskSensitive: boolean;
}

/**
 * Метаданные для логирования
 */
export interface LogMeta {
    module?: string;
    operation?: string;
    sessionId?: string;
    userId?: string;
    requestId?: string;
    duration?: number;
    [key: string]: any;
}

/**
 * Чувствительные поля для маскирования
 */
const SENSITIVE_FIELDS = [
    'apiKey',
    'secretKey',
    'passphrase',
    'password',
    'token',
    'authorization',
    'secret',
    'key',
    'privateKey',
];

/**
 * Функция маскирования чувствительных данных
 */
function maskSensitiveData(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(maskSensitiveData);
    }

    const masked: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        const isSensitive = SENSITIVE_FIELDS.some((field) =>
            keyLower.includes(field.toLowerCase())
        );

        if (isSensitive && typeof value === 'string') {
            masked[key] = '***MASKED***';
        } else if (typeof value === 'object') {
            masked[key] = maskSensitiveData(value);
        } else {
            masked[key] = value;
        }
    }

    return masked;
}

/**
 * Кастомный формат для файловых логов
 */
const fileFormat = winston.format.combine(
    winston.format.timestamp({
        format: () => format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
    }),
    winston.format.errors({ stack: true }),
    winston.format.metadata({
        fillWith: ['timestamp', 'level', 'message'],
    }),
    winston.format.printf(({ timestamp, level, message, metadata, stack }) => {
        let log = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

        // Добавляем метаданные если они есть
        if (metadata && Object.keys(metadata).length > 0) {
            log += `\n  Meta: ${JSON.stringify(maskSensitiveData(metadata), null, 2)}`;
        }

        // Добавляем стек ошибки если есть
        if (stack) {
            log += `\n  Stack: ${stack}`;
        }

        return log;
    })
);

/**
 * Кастомный формат для консольных логов
 */
const consoleFormat = winston.format.combine(
    winston.format.timestamp({
        format: () => format(new Date(), 'HH:mm:ss.SSS'),
    }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        ({ timestamp, level, message, module, operation }) => {
            let log = `[${timestamp}]`;

            if (module) {
                log += ` [${module}]`;
            }

            if (operation) {
                log += ` [${operation}]`;
            }

            log += ` ${level}: ${message}`;

            return log;
        }
    )
);

/**
 * Создание конфигурации логгера
 */
function createLoggerConfig(): LoggerConfig {
    return {
        level: process.env.LOG_LEVEL || 'info',
        logDir: process.env.LOG_DIR || './logs',
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '14'),
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
        enableConsole: process.env.LOG_CONSOLE !== 'false',
        enableFile: process.env.LOG_FILE !== 'false',
        enableErrorFile: process.env.LOG_ERROR_FILE !== 'false',
        colorize: process.env.LOG_COLORIZE !== 'false',
        maskSensitive: process.env.LOG_MASK_SENSITIVE !== 'false',
    };
}

/**
 * Создание транспортов для логгера
 */
function createTransports(config: LoggerConfig): winston.transport[] {
    const transports: winston.transport[] = [];

    // Консольный транспорт
    if (config.enableConsole) {
        transports.push(
            new winston.transports.Console({
                level: config.level,
                format: config.colorize
                    ? consoleFormat
                    : winston.format.simple(),
                handleExceptions: true,
                handleRejections: true,
            })
        );
    }

    // Создаем директорию для логов если не существует
    if (!existsSync(config.logDir)) {
        mkdirSync(config.logDir, { recursive: true });
    }

    // Файловый транспорт для всех логов
    if (config.enableFile) {
        transports.push(
            new winston.transports.File({
                level: config.level,
                filename: join(config.logDir, 'dtrader.log'),
                format: fileFormat,
                maxsize: parseInt(config.maxSize) * 1024 * 1024, // Конвертируем в байты
                maxFiles: config.maxFiles,
                handleExceptions: true,
                handleRejections: true,
            })
        );
    }

    // Отдельный файл для ошибок
    if (config.enableErrorFile) {
        transports.push(
            new winston.transports.File({
                level: 'error',
                filename: join(config.logDir, 'error.log'),
                format: fileFormat,
                maxsize: parseInt(config.maxSize) * 1024 * 1024,
                maxFiles: config.maxFiles,
                handleExceptions: true,
                handleRejections: true,
            })
        );
    }

    return transports;
}

/**
 * Класс Logger с дополнительными возможностями
 */
export class Logger {
    private readonly winston: winston.Logger;
    private readonly config: LoggerConfig;
    private readonly sessionId: string;

    constructor(sessionId: string = 'default') {
        this.config = createLoggerConfig();
        this.sessionId = sessionId;

        this.winston = winston.createLogger({
            level: this.config.level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.metadata()
            ),
            defaultMeta: {
                service: 'dtrader-crypto',
                sessionId: this.sessionId,
            },
            transports: createTransports(this.config),
            exitOnError: false,
        });

        this.setupUnhandledExceptionLogging();
    }

    /**
     * Настройка логирования необработанных исключений
     */
    private setupUnhandledExceptionLogging(): void {
        process.on('uncaughtException', (error: Error) => {
            this.error('Необработанное исключение', {
                error: error.message,
                stack: error.stack,
            });
        });

        process.on(
            'unhandledRejection',
            (reason: unknown, promise: Promise<any>) => {
                this.error('Необработанное отклонение Promise', {
                    reason: String(reason),
                    promise: promise.toString(),
                });
            }
        );
    }

    /**
     * Маскирование данных если включено
     */
    private processMeta(meta: LogMeta = {}): LogMeta {
        if (this.config.maskSensitive) {
            return maskSensitiveData(meta);
        }
        return meta;
    }

    /**
     * Методы логирования
     */
    public error(message: string, meta: LogMeta = {}): void {
        this.winston.error(message, this.processMeta(meta));
    }

    public warn(message: string, meta: LogMeta = {}): void {
        this.winston.warn(message, this.processMeta(meta));
    }

    public info(message: string, meta: LogMeta = {}): void {
        this.winston.info(message, this.processMeta(meta));
    }

    public http(message: string, meta: LogMeta = {}): void {
        this.winston.http(message, this.processMeta(meta));
    }

    public verbose(message: string, meta: LogMeta = {}): void {
        this.winston.verbose(message, this.processMeta(meta));
    }

    public debug(message: string, meta: LogMeta = {}): void {
        this.winston.debug(message, this.processMeta(meta));
    }

    public silly(message: string, meta: LogMeta = {}): void {
        this.winston.silly(message, this.processMeta(meta));
    }

    /**
     * Специализированные методы
     */
    public trading(message: string, meta: LogMeta = {}): void {
        this.info(message, { ...meta, category: 'trading' });
    }

    public api(message: string, meta: LogMeta = {}): void {
        this.http(message, { ...meta, category: 'api' });
    }

    public terminal(message: string, meta: LogMeta = {}): void {
        this.info(message, { ...meta, category: 'terminal' });
    }

    public eventBus(message: string, meta: LogMeta = {}): void {
        this.debug(message, { ...meta, category: 'eventbus' });
    }

    /**
     * Логирование производительности
     */
    public performance(
        operation: string,
        duration: number,
        meta: LogMeta = {}
    ): void {
        const level = duration > 1000 ? 'warn' : 'info';
        this[level](`Операция '${operation}' выполнена за ${duration}ms`, {
            ...meta,
            category: 'performance',
            duration,
            operation,
        });
    }

    /**
     * Логирование с измерением времени
     */
    public time(label: string): void {
        console.time(label);
    }

    public timeEnd(label: string, meta: LogMeta = {}): void {
        console.timeEnd(label);
        // Можно добавить логирование времени в winston если нужно
    }

    /**
     * Создание дочернего логгера с дополнительными метаданными
     */
    public child(defaultMeta: LogMeta): Logger {
        const childLogger = new Logger(this.sessionId);

        // Объединяем метаданные
        const originalProcessMeta = childLogger.processMeta.bind(childLogger);
        childLogger.processMeta = (meta: LogMeta = {}) => {
            return originalProcessMeta({ ...defaultMeta, ...meta });
        };

        return childLogger;
    }

    /**
     * Логирование ошибок с контекстом
     */
    public errorWithContext(
        error: Error,
        context: string,
        meta: LogMeta = {}
    ): void {
        this.error(`${context}: ${error.message}`, {
            ...meta,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
            context,
        });
    }

    /**
     * Получение статистики логирования
     */
    public getStats(): any {
        return {
            level: this.config.level,
            transports: this.winston.transports.length,
            config: this.config,
        };
    }

    /**
     * Изменение уровня логирования во время выполнения
     */
    public setLevel(level: string): void {
        this.winston.level = level;
        this.winston.transports.forEach((transport) => {
            transport.level = level;
        });
        this.info(`Уровень логирования изменен на: ${level}`);
    }

    /**
     * Закрытие логгера и освобождение ресурсов
     */
    public close(): Promise<void> {
        return new Promise((resolve) => {
            this.winston.end(() => {
                resolve();
            });
        });
    }
}

/**
 * Создание глобального экземпляра логгера
 */
function createGlobalLogger(): Logger {
    const sessionId =
        process.env.SESSION_ID ||
        require('crypto').randomBytes(4).toString('hex').toUpperCase();

    return new Logger(sessionId);
}

// Экспорт глобального логгера
export const logger = createGlobalLogger();

/**
 * Middleware для логирования API запросов
 */
export class ApiLogger {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.child({ category: 'api' });
    }

    logRequest(method: string, url: string, headers?: any, body?: any): string {
        const requestId = require('crypto').randomBytes(8).toString('hex');

        this.logger.http(`API Request: ${method} ${url}`, {
            requestId,
            method,
            url,
            headers: headers ? maskSensitiveData(headers) : undefined,
            body: body ? maskSensitiveData(body) : undefined,
        });

        return requestId;
    }

    logResponse(
        requestId: string,
        status: number,
        duration: number,
        data?: any
    ): void {
        const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'http';

        this.logger[level](`API Response: ${status}`, {
            requestId,
            status,
            duration,
            data: data ? maskSensitiveData(data) : undefined,
        });
    }

    logError(requestId: string, error: Error, duration: number): void {
        this.logger.error(`API Error: ${error.message}`, {
            requestId,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
            duration,
        });
    }
}

/**
 * Middleware для логирования торговых операций
 */
export class TradingLogger {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.child({ category: 'trading' });
    }

    logSignal(signal: any): void {
        this.logger.trading('Торговый сигнал получен', {
            signal: maskSensitiveData(signal),
            timestamp: new Date().toISOString(),
        });
    }

    logOrder(
        order: any,
        action: 'create' | 'update' | 'cancel' | 'fill'
    ): void {
        this.logger.trading(`Ордер ${action}`, {
            orderId: order.id,
            action,
            order: maskSensitiveData(order),
            timestamp: new Date().toISOString(),
        });
    }

    logPosition(position: any, action: 'open' | 'close' | 'update'): void {
        this.logger.trading(`Позиция ${action}`, {
            positionId: position.id,
            action,
            position: maskSensitiveData(position),
            timestamp: new Date().toISOString(),
        });
    }

    logPnL(pnl: number, symbol: string, meta: LogMeta = {}): void {
        const level = pnl >= 0 ? 'info' : 'warn';
        this.logger[level](`P&L обновление: ${pnl} для ${symbol}`, {
            ...meta,
            pnl,
            symbol,
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Логгер для EventBus
 */
export class EventBusLogger {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.child({ category: 'eventbus' });
    }

    logEvent(eventName: string, listenerCount: number, data?: any): void {
        this.logger.eventBus(`Событие: ${eventName}`, {
            eventName,
            listenerCount,
            data: data ? maskSensitiveData(data) : undefined,
        });
    }

    logListenerAdd(eventName: string, totalListeners: number): void {
        this.logger.debug(`Добавлен слушатель для: ${eventName}`, {
            eventName,
            totalListeners,
        });
    }

    logListenerRemove(eventName: string, totalListeners: number): void {
        this.logger.debug(`Удален слушатель для: ${eventName}`, {
            eventName,
            totalListeners,
        });
    }

    logError(eventName: string, error: Error): void {
        this.logger.error(`Ошибка в событии: ${eventName}`, {
            eventName,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
        });
    }
}

/**
 * Хелпер для создания специализированных логгеров
 */
export class LoggerFactory {
    private static instance: LoggerFactory;
    private globalLogger: Logger;

    private constructor() {
        this.globalLogger = logger;
    }

    public static getInstance(): LoggerFactory {
        if (!LoggerFactory.instance) {
            LoggerFactory.instance = new LoggerFactory();
        }
        return LoggerFactory.instance;
    }

    public createApiLogger(): ApiLogger {
        return new ApiLogger(this.globalLogger);
    }

    public createTradingLogger(): TradingLogger {
        return new TradingLogger(this.globalLogger);
    }

    public createEventBusLogger(): EventBusLogger {
        return new EventBusLogger(this.globalLogger);
    }

    public createModuleLogger(moduleName: string): Logger {
        return this.globalLogger.child({ module: moduleName });
    }
}

// Экспорт для удобного использования
export const loggerFactory = LoggerFactory.getInstance();
export const apiLogger = loggerFactory.createApiLogger();
export const tradingLogger = loggerFactory.createTradingLogger();
export const eventBusLogger = loggerFactory.createEventBusLogger();

// Хелпер функции
export function createTimer(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
}
