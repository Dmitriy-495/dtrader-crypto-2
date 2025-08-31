import { EventBus } from './EventBus';
import { logger } from '../utils/Logger';
import { format } from 'date-fns';
import { randomBytes } from 'crypto';
import * as terminal from 'terminal-kit';

export interface TerminalConfig {
    colors: boolean;
    unicode: boolean;
    grabInput: boolean;
    mouse: boolean;
}

export interface SessionInfo {
    id: string;
    startTime: Date;
    version: string;
    environment: string;
}

export class TerminalManager {
    private readonly term: terminal.Terminal;
    private readonly eventBus: EventBus;
    private readonly config: TerminalConfig;
    private readonly sessionInfo: SessionInfo;
    private readonly terminalLogger = logger.child({ module: 'terminal' });
    private isInputGrabbed: boolean = false;
    private isInitialized: boolean = false;

    constructor(eventBus: EventBus, config: Partial<TerminalConfig> = {}) {
        this.term = terminal.terminal;
        this.eventBus = eventBus;
        this.config = {
            colors: config.colors ?? true,
            unicode: config.unicode ?? true,
            grabInput: config.grabInput ?? true,
            mouse: config.mouse ?? false,
        };

        this.sessionInfo = {
            id: randomBytes(4).toString('hex').toUpperCase(),
            startTime: new Date(),
            version: process.env.npm_package_version || '2.0.0',
            environment: process.env.NODE_ENV || 'development',
        };

        this.terminalLogger.info('Инициализация TerminalManager', {
            sessionId: this.sessionInfo.id,
            config: this.config,
        });

        this.setupTerminal();
        this.setupEventListeners();
    }

    private setupTerminal(): void {
        try {
            if (!this.config.colors) {
                this.term.noFormat();
            }

            this.term.on('resize', (width: number, height: number) => {
                this.terminalLogger.debug('Изменение размера терминала', {
                    width,
                    height,
                    previous: this.getTerminalSize(),
                });
                this.eventBus.emitTyped('terminal:resize', width, height);
            });

            this.terminalLogger.info('Терминал настроен успешно');
        } catch (error) {
            this.terminalLogger.errorWithContext(
                error as Error,
                'setupTerminal'
            );
            throw error;
        }
    }

    private setupEventListeners(): void {
        this.eventBus.onTyped('app:start', this.handleAppStart.bind(this));
        this.eventBus.onTyped('app:stop', this.handleAppStop.bind(this));
        this.eventBus.onTyped('terminal:exit', this.handleExit.bind(this));

        this.terminalLogger.debug('Event listeners настроены');
    }

    private handleAppStart(): void {
        this.terminalLogger.info('Обработка события app:start');
        this.showWelcomeScreen();
        this.startKeyListener();
        this.isInitialized = true;
        this.terminalLogger.info('Terminal Manager инициализирован');
    }

    private handleAppStop(): void {
        this.terminalLogger.info('Обработка события app:stop');
        this.showShutdownMessage();
        this.stopKeyListener();
    }

    private handleExit(): void {
        this.terminalLogger.info('Получен сигнал выхода');
        this.gracefulShutdown();
    }

    public showWelcomeScreen(): void {
        try {
            this.clearScreen();
            this.drawHeader();
            this.drawSystemInfo();
            this.drawInstructions();
            this.drawStatusLine();

            this.terminalLogger.info('Приветственный экран отображен');
        } catch (error) {
            this.terminalLogger.errorWithContext(
                error as Error,
                'showWelcomeScreen'
            );
        }
    }

    public clearScreen(): void {
        this.term.clear();
    }

    private drawHeader(): void {
        const title = 'DTRADER-CRYPTO 2.0';
        const subtitle = 'Торговый консольный бот для Gate.io';

        this.term.cyan.bold(
            '\n╔══════════════════════════════════════════════════════════════╗\n'
        );
        this.term.cyan.bold(
            '║                                                              ║\n'
        );
        this.term.cyan.bold(`║${this.centerText(title, 62)}║\n`);
        this.term.cyan.bold(
            '║                                                              ║\n'
        );
        this.term.cyan.bold(`║${this.centerText(subtitle, 62)}║\n`);
        this.term.cyan.bold(
            '║                                                              ║\n'
        );
        this.term.cyan.bold(
            '╚══════════════════════════════════════════════════════════════╝\n\n'
        );
    }

    private drawSystemInfo(): void {
        this.term.yellow(`📦 Версия: ${this.sessionInfo.version}\n`);
        this.term.yellow(`🌍 Среда: ${this.sessionInfo.environment}\n`);
        this.term.yellow(`⚡ Node.js: ${process.version}\n`);
        this.term.yellow(
            `🕐 Время запуска: ${format(this.sessionInfo.startTime, 'dd.MM.yyyy HH:mm:ss')}\n`
        );
        this.term.yellow(`🆔 ID сессии: ${this.sessionInfo.id}\n\n`);
    }

    private drawStatusLine(): void {
        this.term.green('✓ Терминальный интерфейс: ').white('Активен\n');
        this.term.green('✓ Event Bus: ').white('Инициализирован\n');
        this.term.green('✓ Logger: ').white('Настроен\n');
        this.term.green('✓ Система: ').white('Готова к работе\n\n');

        this.term.cyan('⏳ Ожидание команд...\n\n');
    }

    private drawInstructions(): void {
        this.term.white.bold('🎮 Управление:\n');
        this.term
            .white('• Нажмите ')
            .yellow.bold('Ctrl+X')
            .white(' для корректного выхода\n');
        this.term
            .white('• Нажмите ')
            .yellow.bold('Ctrl+C')
            .white(' для экстренного завершения\n\n');
    }

    private startKeyListener(): void {
        if (this.config.grabInput && !this.isInputGrabbed) {
            try {
                this.term.grabInput({ mouse: this.config.mouse });
                this.isInputGrabbed = true;
                this.term.on('key', this.handleKeyPress.bind(this));

                this.terminalLogger.info('Прослушивание клавиатуры запущено');
            } catch (error) {
                this.terminalLogger.errorWithContext(
                    error as Error,
                    'startKeyListener'
                );
            }
        }
    }

    private stopKeyListener(): void {
        if (this.isInputGrabbed) {
            try {
                this.term.grabInput(false);
                this.isInputGrabbed = false;
                this.terminalLogger.info(
                    'Прослушивание клавиатуры остановлено'
                );
            } catch (error) {
                this.terminalLogger.errorWithContext(
                    error as Error,
                    'stopKeyListener'
                );
            }
        }
    }

    private handleKeyPress(name: string, matches: any, data: any): void {
        try {
            this.terminalLogger.debug('Нажата клавиша', {
                keyName: name,
                hasMatches: !!matches,
                dataKeys: data ? Object.keys(data) : [],
            });

            // Обработка команд выхода
            if (name === 'CTRL_X' || name === 'CTRL_C') {
                this.terminalLogger.info('Получена команда выхода', {
                    keyName: name,
                });
                this.eventBus.emitTyped('terminal:exit');
                return;
            }

            // Передача события в Event Bus
            this.eventBus.emitTyped('terminal:key', name, data);

            // Отображение в режиме отладки
            if (this.sessionInfo.environment === 'development') {
                this.showKeyPress(name);
            }
        } catch (error) {
            this.terminalLogger.errorWithContext(
                error as Error,
                'handleKeyPress',
                {
                    keyName: name,
                }
            );
        }
    }

    private showKeyPress(keyName: string): void {
        const timestamp = format(new Date(), 'HH:mm:ss');
        this.term
            .gray(`[${timestamp}] 🔘 Нажата клавиша: `)
            .white(`${keyName}\n`);
    }

    private showShutdownMessage(): void {
        this.terminalLogger.info('Отображение сообщения о завершении');
        this.term.yellow('\n🔄 Завершение работы приложения...\n');
        this.term.green('📝 Сохранение состояния...\n');
        this.term.green('🔌 Отключение от Event Bus...\n');
        this.term.green('🧹 Освобождение ресурсов...\n');
    }

    public gracefulShutdown(): void {
        if (!this.isInitialized) {
            this.terminalLogger.warn(
                'Попытка завершения неинициализированного терминала'
            );
            process.exit(0);
            return;
        }

        this.terminalLogger.info('Начало корректного завершения работы');
        this.showShutdownMessage();
        this.stopKeyListener();

        this.term.cyan
            .bold('\n👋 Спасибо за использование ')
            .white.bold('dtrader-crypto 2.0')
            .cyan.bold('!\n');
        this.term.cyan('🚀 До свидания!\n\n');

        setTimeout(() => {
            this.terminalLogger.info('Завершение процесса');
            process.exit(0);
        }, 80);
    }

    public showError(message: string, error?: Error): void {
        this.term.red.bold('\n❌ Ошибка: ').red(message);
        if (error && this.sessionInfo.environment === 'development') {
            this.term.red('\n📋 Детали: ').gray(error.stack || error.message);
        }
        this.term('\n');

        this.terminalLogger.error('Отображена ошибка пользователю', {
            message,
            hasErrorDetails: !!error,
        });
    }

    public showSuccess(message: string): void {
        // ИСПРАВЛЕНА ОШИБКА: убран неправильный .term()
        this.term.green.bold('✅ ').green(message)('\n');
        this.terminalLogger.info('Отображено сообщение успеха', { message });
    }

    public showInfo(message: string): void {
        this.term.blue.bold('ℹ️  ').blue(message)('\n');
        this.terminalLogger.info('Отображено информационное сообщение', {
            message,
        });
    }

    public showWarning(message: string): void {
        this.term.yellow.bold('⚠️  ').yellow(message)('\n');
        this.terminalLogger.warn('Отображено предупреждение', { message });
    }

    private centerText(text: string, width: number): string {
        const padding = Math.max(0, width - text.length);
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    }

    public getSessionInfo(): SessionInfo {
        return { ...this.sessionInfo };
    }

    public getTerminalSize(): { width: number; height: number } {
        return {
            width: this.term.width,
            height: this.term.height,
        };
    }

    public isReady(): boolean {
        return this.isInitialized && this.isInputGrabbed;
    }
}
