import { EventEmitter } from 'events';
import { eventBusLogger } from '../utils/Logger';

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
 */
export class EventBus extends EventEmitter {
    private readonly maxListeners: number;
    private readonly enableLogging: boolean;

    constructor(maxListeners: number = 50, enableLogging: boolean = true) {
        super();
        this.maxListeners = maxListeners;
        this.enableLogging = enableLogging;
        this.setMaxListeners(this.maxListeners);

        this.setupErrorHandling();
        this.setupEventLogging();

        eventBusLogger.logEvent('eventbus:initialized', 0, { maxListeners });
    }

    private setupErrorHandling(): void {
        this.on('error', (error: Error) => {
            eventBusLogger.logError('eventbus:error', error);
        });

        this.on('newListener', (eventName: string) => {
            const totalListeners = this.listenerCount(eventName) + 1;
            eventBusLogger.logListenerAdd(eventName, totalListeners);
        });

        this.on('removeListener', (eventName: string) => {
            const totalListeners = this.listenerCount(eventName) - 1;
            eventBusLogger.logListenerRemove(eventName, totalListeners);
        });
    }

    private setupEventLogging(): void {
        if (this.enableLogging) {
            const originalEmit = this.emit.bind(this);
            this.emit = (
                eventName: string | symbol,
                ...args: any[]
            ): boolean => {
                const listeners = this.listenerCount(eventName);
                eventBusLogger.logEvent(String(eventName), listeners, {
                    argsCount: args.length,
                });
                return originalEmit(eventName, ...args);
            };
        }
    }

    public emitTyped<K extends keyof AppEvents>(
        event: K,
        ...args: Parameters<AppEvents[K]>
    ): boolean {
        try {
            return this.emit(event, ...args);
        } catch (error) {
            eventBusLogger.logError(event, error as Error);
            return false;
        }
    }

    public onTyped<K extends keyof AppEvents>(
        event: K,
        listener: AppEvents[K]
    ): this {
        return this.on(event, listener);
    }

    public onceTyped<K extends keyof AppEvents>(
        event: K,
        listener: AppEvents[K]
    ): this {
        return this.once(event, listener);
    }

    public offTyped<K extends keyof AppEvents>(
        event: K,
        listener: AppEvents[K]
    ): this {
        return this.off(event, listener);
    }

    public getListenersInfo(): Record<string, number> {
        const info: Record<string, number> = {};
        const events = this.eventNames();

        for (const event of events) {
            info[String(event)] = this.listenerCount(event);
        }

        eventBusLogger.logEvent('eventbus:stats', 0, { listenersInfo: info });
        return info;
    }

    public cleanup(): void {
        eventBusLogger.logEvent('eventbus:cleanup', 0);
        this.removeAllListeners();
    }

    public hasListeners(event: keyof AppEvents): boolean {
        return this.listenerCount(event) > 0;
    }
}

export const eventBus = new EventBus(
    parseInt(process.env.EVENT_BUS_MAX_LISTENERS || '50'),
    process.env.NODE_ENV === 'development'
);
