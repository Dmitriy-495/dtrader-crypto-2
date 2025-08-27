import { IStrategy } from "./IStrategy";
import { StrategyState, PriceUpdate, TradeSignal } from "../types";
import { eventBus } from "../services/eventBus";

/**
 * Простая демонстрационная стратегия:
 * - Покупает 0.001 BTC, если цена падает ниже 40,000 USDT.
 * - Продает 0.001 BTC, если цена поднимается выше 70,000 USDT.
 */
export class DemoStrategy implements IStrategy {
  public readonly name = "BTC_Cross_40k_70k";
  public state: StrategyState = "STOPPED";

  // Внутреннее состояние стратегии: помнит, была ли совершена покупка.
  private hasBought = false;

  /** @inheritdoc */
  start(): void {
    if (this.state === "RUNNING") return;
    this.state = "RUNNING";
    eventBus.emit("log", {
      level: "INFO",
      message: `Стратегия '${this.name}' запущена.`,
    });
  }

  /** @inheritdoc */
  pause(): void {
    if (this.state !== "RUNNING") return;
    this.state = "PAUSED";
    eventBus.emit("log", {
      level: "WARN",
      message: `Стратегия '${this.name}' приостановлена.`,
    });
  }

  /** @inheritdoc */
  stop(): void {
    this.state = "STOPPED";
    this.hasBought = false; // Сброс внутреннего состояния при остановке.
    eventBus.emit("log", {
      level: "ERROR",
      message: `Стратегия '${this.name}' остановлена.`,
    });
  }

  /**
   * @inheritdoc
   * Главная логика стратегии: анализ цены и принятие решения.
   */
  onPriceUpdate(update: PriceUpdate): void {
    // Игнорируем обновления, если стратегия не активна или если это не наша пара.
    if (this.state !== "RUNNING" || update.pair !== "BTC_USDT") {
      return;
    }

    const currentPrice = parseFloat(update.price);

    // Условие на покупку
    if (!this.hasBought && currentPrice < 40000) {
      this.hasBought = true; // Меняем внутреннее состояние
      const signal: TradeSignal = {
        strategy: this.name,
        pair: "BTC_USDT",
        action: "BUY",
        price: update.price,
        amount: "0.001",
      };
      // Отправляем сигнал на исполнение через EventBus.
      eventBus.emit("trade:execute", signal);
    }
    // Условие на продажу
    else if (this.hasBought && currentPrice > 70000) {
      this.hasBought = false;
      const signal: TradeSignal = {
        strategy: this.name,
        pair: "BTC_USDT",
        action: "SELL",
        price: update.price,
        amount: "0.001",
      };
      eventBus.emit("trade:execute", signal);
    }
  }
}
