import { StrategyState, PriceUpdate } from "../types";

export interface IStrategy {
  /** Уникальное имя стратегии. */
  readonly name: string;
  /** Текущее состояние стратегии (запущена, остановлена, на паузе). */
  state: StrategyState;

  /** Метод для запуска логики стратегии. */
  start(): void;
  /** Метод для приостановки логики с сохранением внутреннего состояния. */
  pause(): void;
  /** Метод для полной остановки и сброса внутреннего состояния. */
  stop(): void;

  /** Метод, который Менеджер Стратегий вызывает при каждом обновлении цены. */
  onPriceUpdate(update: PriceUpdate): void;
}
