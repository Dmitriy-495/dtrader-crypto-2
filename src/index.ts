// src/index.ts

import "dotenv/config";
const termkit = require("terminal-kit");
// Мы НЕ используем `termkit.terminal` до вызова callback.

import { createLayout } from "./ui/layout";
import { eventBus } from "./services/eventBus";
import { GateioService } from "./services/gateio";
import { StrategyManager } from "./core/StrategyManager";
import { DemoStrategy } from "./strategies/DemoStrategy";
import { formatNumber } from "./core/helpers";
import { LogToFileService } from "./services/LogToFileService";
import {
  LogMessage,
  LogLevel,
  PriceUpdate,
  BalanceUpdate,
  ConnectionState,
  PongUpdate,
  TradeSignal,
} from "./types";

const logLevelStyles: Record<LogLevel, { color: string; icon: string }> = {
  SUCCESS: { color: "green", icon: "✔" },
  INFO: { color: "cyan", icon: "»" },
  WARN: { color: "yellow", icon: "▲" },
  ERROR: { color: "red", icon: "✖" },
  TRADE: { color: "magenta", icon: "⚡" },
};

let isShuttingDown = false;

function gracefulShutdown(terminal: any, code: number = 0): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  terminal.grabInput(false);
  setTimeout(() => {
    console.log(`\nПроцесс завершен с кодом ${code}.`);
    process.exit(code);
  }, 200);
}

/**
 * Основная точка входа в приложение.
 * @param terminal - Гарантированно инициализированный экземпляр терминала.
 */
async function main(terminal: any) {
  // Получаем конструктор TextBox из модуля.
  const TextBox = termkit.TextBox;

  try {
    const logToFileService = new LogToFileService();

    // --- ИНИЦИАЛИЗАЦИЯ UI С ИСПОЛЬЗОВАНИЕМ ГОТОВОГО `terminal` ---
    terminal.clear();
    // Передаем готовый `terminal` в функцию создания UI.
    const { document, mainContent, sidebar, footer, statusWidget } =
      createLayout(terminal);

    // --- АКТИВАЦИЯ ПОДПИСОК ---
    eventBus.on("log", (log: LogMessage) => {
      const style = logLevelStyles[log.level] ?? logLevelStyles["INFO"];
      const timestamp = new Date().toLocaleTimeString();
      sidebar.log(
        `^${style.color}${style.icon}^: [${timestamp}] ${log.message}`
      );
    });

    logToFileService.startListening();
    eventBus.emit("log", {
      level: "INFO",
      message: "Приложение запускается...",
    });
    eventBus.emit("log", {
      level: "SUCCESS",
      message: "UI успешно инициализирован.",
    });

    // ... (остальной код создания виджетов, сервисов, подписок на события) ...
    const balanceWidget = new TextBox({
      /* ... */
    });
    const priceWidget = new TextBox({
      /* ... */
    });
    const apiKey = process.env.GATE_API_KEY,
      apiSecret = process.env.GATE_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error("Ключи API не найдены.");
    const gateioService = new GateioService(apiKey, apiSecret);
    const strategyManager = new StrategyManager();
    strategyManager.addStrategy(new DemoStrategy());
    let connectionStatus: ConnectionState = "disconnected";
    let lastLatency = 0;
    const priceCache = {};
    const updateStatusWidget = () => {
      /* ... */
    };
    eventBus.on("connection:state", ({ state }) => {
      connectionStatus = state;
      updateStatusWidget();
    });
    eventBus.on("connection:pong", ({ latency }) => {
      lastLatency = latency;
      updateStatusWidget();
    });
    eventBus.on("update:price", (data) => {
      /* ... */
    });
    eventBus.on("update:balance", (data) => {
      /* ... */
    });
    eventBus.on("trade:execute", (signal) => {
      /* ... */
    });

    footer.on("submit", (command: string) => {
      // ... (обработка команд, вызывает gracefulShutdown(terminal) при 'exit') ...
    });

    // --- Обработчики используют переданный `terminal` ---
    terminal.on("key", (name: string) => {
      if (name === "CTRL_C") {
        eventBus.emit("log", {
          level: "WARN",
          message: "Получен сигнал CTRL+C...",
        });
        gracefulShutdown(terminal);
      }
    });

    terminal.grabInput({ mouse: "button" });
    document.focusNext();

    await gateioService.connect();

    eventBus.emit("log", { level: "SUCCESS", message: "Бот готов к работе." });
  } catch (error) {
    const errorMessage = `КРИТИЧЕСКАЯ ОШИБКА: ${
      (error as Error).stack || (error as Error).message
    }`;
    try {
      eventBus.emit("log", { level: "ERROR", message: errorMessage });
    } catch (e) {}
    console.error("\n" + errorMessage);
    gracefulShutdown(terminal, 1);
  }
}

// --- ИСТИННАЯ, ЕДИНСТВЕННО ВЕРНАЯ ТОЧКА ВХОДА ---
// Вызываем метод `getDetectedTerminal` на самом модуле `termkit`.
termkit.getDetectedTerminal((error: Error | null, term: any) => {
  if (error) {
    console.error(
      "Критическая ошибка: Не удалось инициализировать терминал.",
      error
    );
    process.exit(1);
  }

  // `term` - это ГОТОВЫЙ к работе экземпляр.
  // Запускаем основную логику, передавая ей этот готовый экземпляр.
  main(term).catch((err) => {
    console.error("Необработанная критическая ошибка в main:", err);
    gracefulShutdown(term, 1);
  });
});
