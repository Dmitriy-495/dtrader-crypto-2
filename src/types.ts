// src/types.ts

// --- Типы для Логирования ---
export type LogLevel = "SUCCESS" | "INFO" | "WARN" | "ERROR" | "TRADE";
export interface LogMessage {
  level: LogLevel;
  message: string;
}

// --- Типы для Состояния Соединения ---
export type ConnectionState = "connected" | "disconnected" | "connecting";
export interface ConnectionStateUpdate {
  state: ConnectionState;
}
export interface PongUpdate {
  latency: number;
}

// --- Типы для Рыночных Данных и Баланса ---
export interface PriceUpdate {
  pair: string; // e.g., 'BTC_USDT'
  price: string;
}
export interface BalanceUpdate {
  currency: string; // e.g., 'USDT'
  total: string;
}

// --- Типы для Стратегий и Торговли ---
export type StrategyState = "STOPPED" | "RUNNING" | "PAUSED";

export interface TradeSignal {
  strategy: string;
  pair: string;
  action: "BUY" | "SELL";
  price: string;
  amount: string;
}

// --- НЕДОСТАЮЩИЕ ТИПЫ ДЛЯ GATE.IO ---
// Вот типы, которых не хватало. Теперь gateio.ts сможет их импортировать.

/**
 * Универсальный тип для сообщения с сервера Gate.io WebSocket.
 * T - это тип для поля 'result'.
 */
export interface GateioMessage<T> {
  time: number;
  channel: string;
  event: "update" | "subscribe" | "login" | "pong";
  error: {
    code: number;
    message: string;
  } | null;
  result: T;
}

/**
 * Тип для результата из канала 'spot.tickers'.
 */
export type TickerResult = {
  currency_pair: string;
  last: string;
};

/**
 * Тип для результата из канала 'spot.balances'.
 */
export type BalanceResult = {
  currency: string;
  available: string;
};

/**
 * Тип для результата из канала 'spot.login'.
 */
export type LoginResult = {
  status: "success";
};
