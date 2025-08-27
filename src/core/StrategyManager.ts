import { IStrategy } from "../strategies/IStrategy";
import { eventBus } from "../services/eventBus";
import { PriceUpdate } from "../types";

export class StrategyManager {
  private strategies = new Map<string, IStrategy>();

  /**
   * В конструкторе подписываемся на глобальные обновления цен.
   */
  constructor() {
    eventBus.on("update:price", (update: PriceUpdate) => {
      this.onPriceUpdate(update);
    });
  }

  /** Добавляет новую стратегию в пул менеджера. */
  public addStrategy(strategy: IStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /** Запускает стратегию по ее имени. */
  public startStrategy(name: string): void {
    const strategy = this.strategies.get(name);
    if (strategy) strategy.start();
    else
      eventBus.emit("log", {
        level: "ERROR",
        message: `Стратегия '${name}' не найдена.`,
      });
  }

  /** Приостанавливает стратегию по ее имени. */
  public pauseStrategy(name: string): void {
    const strategy = this.strategies.get(name);
    if (strategy) strategy.pause();
  }

  /** Останавливает стратегию по ее имени. */
  public stopStrategy(name: string): void {
    const strategy = this.strategies.get(name);
    if (strategy) strategy.stop();
  }

  /**
   * Вызывается при каждом обновлении цены и передает его всем активным стратегиям.
   * @param update - Объект с данными о новой цене.
   */
  private onPriceUpdate(update: PriceUpdate): void {
    for (const strategy of this.strategies.values()) {
      if (strategy.state === "RUNNING") {
        strategy.onPriceUpdate(update);
      }
    }
  }
}
