import { EventBus } from './EventBus';
import { format } from 'date-fns';
import { randomBytes } from 'crypto';
import * as terminal from 'terminal-kit';

/**
 * Конфигурация терминала
 */
export interface TerminalConfig {
    colors: boolean;
    unicode: boolean;
    grabInput: boolean;
    mouse: boolean;
}

/**
 * Информация о сессии
 */
export interface SessionInfo {
    id: string;
    startTime: Date;
    version: string;
    environment: string;
}

/**
 * Менеджер терминального интерфейса
 * Обеспечивает взаимодействие с пользователем через консольный интерфейс
 */
export class TerminalManager {
    private readonly term: terminal.Terminal;
    private readonly eventBus: EventBus;
    private readonly config: TerminalConfig;
    private readonly sessionInfo: SessionInfo;
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

        this.setupTerminal();
        this.setupEventListeners();
    }

    /**
     * Настройка терминала
     */
    private setupTerminal(): void {
        // Настройка кодировки и цветов
        if (!this.config.colors) {
            this.term.noFormat();
        }

        // Обработка изменения размера терминала
        this.term.on('resize', (width: number, height: number) => {
            this.eventBus.emitTyped('terminal:resize', width, height);
        });
    }

    /**
     * Настройка слушателей событий
     */
    private setupEventListeners(): void {
        this.eventBus.onTyped('app:start', this.handleAppStart.bind(this));
        this.eventBus.onTyped('app:stop', this.handleAppStop.bind(this));
        this.eventBus.onTyped('terminal:exit', this.handleExit.bind(this));
    }

    /**
     * Обработка запуска приложения
     */
    private handleAppStart(): void {
        this.showWelcomeScreen();
        this.startKeyListener();
        this.isInitialized = true;
    }

    /**
     * Обработка остановки приложения
     */
    private handleAppStop(): void {
        this.showShutdownMessage();
        this.stopKeyListener();
    }

    /**
     * Обработка выхода из терминала
     */
    private handleExit(): void {
        this.gracefulShutdown();
    }

    /**
     * Отображение приветственного экрана
     */
    public showWelcomeScreen(): void {
        this.clearScreen();
        this.drawHeader();
        this.drawSystemInfo();
        this.drawInstructions();
        this.drawStatusLine();
    }

    /**
     * Очистка экрана терминала
     */
    public clearScreen(): void {
        this.term.clear();
    }

    /**
     * Отрисовка заголовка приложения
     */
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

    /**
     * Отрисовка системной информации
     */
    private drawSystemInfo(): void {
        this.term.yellow(`📦 Версия: ${this.sessionInfo.version}\n`);
        this.term.yellow(`🌍 Среда: ${this.sessionInfo.environment}\n`);
        this.term.yellow(`⚡ Node.js: ${process.version}\n`);
        this.term.yellow(
            `🕐 Время запуска: ${format(this.sessionInfo.startTime, 'dd.MM.yyyy HH:mm:ss')}\n`
        );
        this.term.yellow(`🆔 ID сессии: ${this.sessionInfo.id}\n\n`);
    }

    /**
     * Отрисовка статуса системы
     */
    private drawStatusLine(): void {
        this.term.green('✓ Терминальный интерфейс: ').white('Активен\n');
        this.term.green('✓ Event Bus: ').white('Инициализирован\n');
        this.term.green('✓ Система: ').white('Готова к работе\n\n');

        this.term.cyan('⏳ Ожидание команд...\n\n');
    }

    /**
     * Отрисовка инструкций
     */
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

    /**
     * Запуск прослушивания клавиатуры
     */
    private startKeyListener(): void {
        if (this.config.grabInput && !this.isInputGrabbed) {
            this.term.grabInput({ mouse: this.config.mouse });
            this.isInputGrabbed = true;

            this.term.on('key', this.handleKeyPress.bind(this));
        }
    }

    /**
     * Остановка прослушивания клавиатуры
     */
    private stopKeyListener(): void {
        if (this.isInputGrabbed) {
            this.term.grabInput(false);
            this.isInputGrabbed = false;
        }
    }

    /**
     * Обработка нажатий клавиш
     */
    private handleKeyPress(name: string, matches: any, data: any): void {
        // Обработка команд выхода
        if (name === 'CTRL_X') {
            this.eventBus.emitTyped('terminal:exit');
            return;
        }

        if (name === 'CTRL_C') {
            this.eventBus.emitTyped('terminal:exit');
            return;
        }

        // Передача события в Event Bus для обработки другими компонентами
        this.eventBus.emitTyped('terminal:key', name, data);

        // Отображение нажатой клавиши в режиме отладки
        if (this.sessionInfo.environment === 'development') {
            this.showKeyPress(name);
        }
    }

    /**
     * Отображение нажатой клавиши (отладка)
     */
    private showKeyPress(keyName: string): void {
        const timestamp = format(new Date(), 'HH:mm:ss');
        this.term
            .gray(`[${timestamp}] 🔘 Нажата клавиша: `)
            .white(`${keyName}\n`);
    }

    /**
     * Отображение сообщения о завершении работы
     */
    private showShutdownMessage(): void {
        this.term.yellow('\n🔄 Завершение работы приложения...\n');
        this.term.green('📝 Сохранение состояния...\n');
        this.term.green('🔌 Отключение от Event Bus...\n');
        this.term.green('🧹 Освобождение ресурсов...\n');
    }

    /**
     * Корректное завершение работы терминала
     */
    public gracefulShutdown(): void {
        if (!this.isInitialized) {
            process.exit(0);
            return;
        }

        this.showShutdownMessage();
        this.stopKeyListener();

        // Финальное сообщение
        this.term.cyan
            .bold('\n👋 Спасибо за использование ')
            .white.bold('dtrader-crypto 2.0')
            .cyan.bold('!\n');
        this.term.cyan('🚀 До свидания!\n\n');

        // Небольшая задержка для отображения сообщений
        setTimeout(() => {
            process.exit(0);
        }, 80);
    }

    /**
     * Отображение ошибки
     */
    public showError(message: string, error?: Error): void {
        this.term.red.bold('\n❌ Ошибка: ').red(message);
        if (error && this.sessionInfo.environment === 'development') {
            this.term.red('\n📋 Детали: ').gray(error.stack || error.message);
        }
        this.term('\n');
    }

    /**
     * Отображение успешного сообщения
     */
    public showSuccess(message: string): void {
        this.term.green.bold('✅ ').green(message).term('\n');
    }

    /**
     * Отображение информационного сообщения
     */
    public showInfo(message: string): void {
        this.term.blue.bold('ℹ️  ').blue(message).term('\n');
    }

    /**
     * Отображение предупреждения
     */
    public showWarning(message: string): void {
        this.term.yellow.bold('⚠️  ').yellow(message).term('\n');
    }

    /**
     * Центрирование текста для фиксированной ширины
     */
    private centerText(text: string, width: number): string {
        const padding = Math.max(0, width - text.length);
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    }

    /**
     * Получение информации о сессии
     */
    public getSessionInfo(): SessionInfo {
        return { ...this.sessionInfo };
    }

    /**
     * Получение размеров терминала
     */
    public getTerminalSize(): { width: number; height: number } {
        return {
            width: this.term.width,
            height: this.term.height,
        };
    }

    /**
     * Проверка готовности терминала
     */
    public isReady(): boolean {
        return this.isInitialized && this.isInputGrabbed;
    }
}
