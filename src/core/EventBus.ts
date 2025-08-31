import { EventEmitter } from 'events';

/**
 * Типы событий в системе
 */
export interface AppEvents {
    'app:start': () => void;
    'app:stop': () => void;
    'app:error': (error: Error) => void;
    'terminal:exit': () => void;
    'terminal:key': (keyName: string, data: any) => void;
    'terminal:resize': (width: number, height: number) => void;
    'config:loaded': (config: any) => void;
    'config:error': (error: Error) => void;
    'engine:start': () => void;
    'engine:stop': () => void;
    'engine:error': (error: Error) => void;
    'trading:signal': (signal: any) => void;
    'trading:order': (order: any) => void;
    'trading:position': (position: any) => void;
}

/**
 * Расширенный Event Bus для торгового бота
 * Обеспечивает типизированный обмен событиями между компонентами
 */
export class EventBus extends EventEmitter {
    private readonly maxListeners: number;
    private readonly debugMode: boolean;

    constructor(maxListeners: number = 50, debugMode: boolean = false) {
        super();
        this.maxListeners = maxListeners;
        this.debugMode = debugMode;
        this.setMaxListeners(this.maxListeners);

        this.setupErrorHandling();
        this.setupDebugLogging();
    }

    /**
     * Настройка обработки ошибок EventBus
     */
    private setupErrorHandling(): void {
        this.on('error', (error: Error) => {
            console.error('[EventBus] Ошибка:', error.message);
        });

        // Предотвращение падения приложения при необработанных событиях
        this.on('newListener', (eventName: string) => {
            if (this.debugMode) {
                console.log(
                    `[EventBus] Новый слушатель для события: ${eventName}`
                );
            }
        });

        this.on('removeListener', (eventName: string) => {
            if (this.debugMode) {
                console.log(
                    `[EventBus] Удален слушатель для события: ${eventName}`
                );
            }
        });
    }

    /**
     * Настройка отладочного логирования
     */
    private setupDebugLogging(): void {
        if (this.debugMode) {
            const originalEmit = this.emit.bind(this);
            this.emit = (
                eventName: string | symbol,
                ...args: any[]
            ): boolean => {
                console.log(
                    `[EventBus] Событие: ${String(eventName)}, Аргументы:`,
                    args.length
                );
                return originalEmit(eventName, ...args);
            };
        }
    }

    /**
     * Типизированный emit для событий приложения
     */
    public emitTyped<K extends keyof AppEvents>(
        event: K,
        ...args: Parameters<AppEvents[K]>
    ): boolean {
        return this.emit(event, ...args);
    }

    /**
     * Типизированный on для событий приложения
     */
    public onTyped<K extends keyof AppEvents>(
        event: K,
        listener: AppEvents[K]
    ): this {
        return this.on(event, listener);
    }

    /**
     * Типизированный once для событий приложения
     */
    public onceTyped<K extends keyof AppEvents>(
        event: K,
        listener: AppEvents[K]
    ): this {
        return this.once(event, listener);
    }

    /**
     * Типизированный off для событий приложения
     */
    public offTyped<K extends keyof AppEvents>(
        event: K,
        listener: AppEvents[K]
    ): this {
        return this.off(event, listener);
    }

    /**
     * Получение информации о текущих слушателях
     */
    public getListenersInfo(): Record<string, number> {
        const info: Record<string, number> = {};
        const events = this.eventNames();

        for (const event of events) {
            info[String(event)] = this.listenerCount(event);
        }

        return info;
    }

    /**
     * Безопасное удаление всех слушателей
     */
    public cleanup(): void {
        if (this.debugMode) {
            console.log('[EventBus] Очистка всех слушателей...');
        }

        this.removeAllListeners();
    }

    /**
     * Проверка наличия слушателей для события
     */
    public hasListeners(event: keyof AppEvents): boolean {
        return this.listenerCount(event) > 0;
    }
}

// Создание глобального экземпляра EventBus
export const eventBus = new EventBus(
    parseInt(process.env.EVENT_BUS_MAX_LISTENERS || '50'),
    process.env.NODE_ENV === 'development'
);
