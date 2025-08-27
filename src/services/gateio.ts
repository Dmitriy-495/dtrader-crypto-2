// src/services/gateio.ts

import WebSocket from "ws";
import * as crypto from "crypto";
import { eventBus } from "./eventBus";
import {
  LogLevel,
  TradeSignal,
  GateioMessage,
  BalanceResult,
  TickerResult,
} from "../types";

/**
 * Вспомогательная функция для отправки стандартизированных логов в EventBus.
 */
function emitLog(level: LogLevel, message: string) {
  eventBus.emit("log", { level, message });
}

/**
 * Генерирует объект `auth` для подписи приватных запросов.
 */
function genWsAuth(
  channel: string,
  event: string,
  timestamp: number,
  apiKey: string,
  apiSecret: string
): object {
  const signatureString = `channel=${channel}&event=${event}&time=${timestamp}`;
  const signature = crypto
    .createHmac("sha512", apiSecret)
    .update(signatureString)
    .digest("hex");

  return {
    method: "api_key",
    KEY: apiKey,
    SIGN: signature,
  };
}

/**
 * GateioService инкапсулирует всю логику взаимодействия с WebSocket API биржи Gate.io.
 */
export class GateioService {
  private ws: WebSocket | null = null;
  private readonly wsUrl = "wss://api.gateio.ws/ws/v4/";
  private pingInterval: NodeJS.Timeout | null = null;
  private pingSentTime: number = 0;

  constructor(private apiKey: string, private apiSecret: string) {}

  /**
   * Асинхронно подключается к WebSocket API, используя Promise-цепочку.
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      emitLog("INFO", "Попытка подключения к Gate.io WebSocket...");
      eventBus.emit("connection:state", { state: "connecting" });

      this.ws = new WebSocket(this.wsUrl);

      this.ws.once("error", (err) => {
        emitLog(
          "ERROR",
          `Критическая ошибка сокета при подключении: ${err.message}`
        );
        reject(err);
      });

      this.ws.once("open", async () => {
        emitLog(
          "SUCCESS",
          "WebSocket-соединение открыто. Запускаем процедуру рукопожатия..."
        );

        try {
          await this.performConnectionHandshake();
          // Если рукопожатие успешно, запускаем постоянные сервисы.
          this.startPermanentServices();
          resolve();
        } catch (err) {
          emitLog(
            "ERROR",
            `Не удалось завершить подключение: ${(err as Error).message}`
          );
          this.ws?.close();
          reject(err);
        }
      });
    });
  }

  /**
   * [ПОЛНОСТЬЮ ПЕРЕРАБОТАННЫЙ МЕТОД]
   * Выполняет последовательную цепочку асинхронных операций для установки соединения.
   * Использует async/await для максимальной читаемости.
   */
  private async performConnectionHandshake(): Promise<void> {
    // ШАГ 1: Отправляем Ping и асинхронно ждем Pong
    emitLog("INFO", "ШАГ 1: Проверка активности соединения (Ping)...");
    const pongMessage = await this.sendPingAndAwaitPong(10000); // Таймаут 10 секунд
    emitLog(
      "SUCCESS",
      `ШАГ 2: Pong получен! Ответ сервера: ${JSON.stringify(pongMessage)}`
    );

    // ШАГ 2: Отправляем подписанный запрос на баланс и ждем подтверждения
    emitLog("INFO", "ШАГ 3: Отправка запроса на подписку на баланс...");
    const confirmationMessage =
      await this.sendBalancesSubscriptionAndAwaitConfirmation(10000);

    // ШАГ 3: Проверяем ответ сервера на подписку
    if (confirmationMessage.error === null) {
      emitLog(
        "SUCCESS",
        `ШАГ 4: Успешная подписка! Ответ сервера: ${JSON.stringify(
          confirmationMessage
        )}`
      );
    } else {
      // Если сервер вернул ошибку, создаем информативное исключение.
      const errorMessage = `Ошибка подписки на баланс: ${
        confirmationMessage.error.message ||
        JSON.stringify(confirmationMessage.error)
      }`;
      throw new Error(errorMessage);
    }
  }

  /**
   * [НОВЫЙ МЕТОД] Отправляет PING и ждет PONG в ответ.
   * @param timeout - Время ожидания в миллисекундах.
   */
  private sendPingAndAwaitPong(timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const time = Math.floor(Date.now() / 1000);

      const onMessage = (data: WebSocket.Data) => {
        const message = JSON.parse(data.toString());
        emitLog("INFO", `[SERVER] <= ${data.toString()}`);
        if (message.channel === "spot.pong" && message.time === time) {
          cleanUp();
          resolve(message);
        }
      };

      const onError = (err: Error) => {
        cleanUp();
        reject(err);
      };

      const onTimeout = () => {
        cleanUp();
        reject(new Error(`Таймаут ожидания Pong (${timeout}ms)`));
      };

      const timer = setTimeout(onTimeout, timeout);

      const cleanUp = () => {
        clearTimeout(timer);
        this.ws?.removeListener("message", onMessage);
        this.ws?.removeListener("error", onError);
      };

      this.ws?.on("message", onMessage);
      this.ws?.once("error", onError);

      const request = { time: time, channel: "spot.ping" };
      this.sendMessage(request);
    });
  }

  /**
   * [НОВЫЙ МЕТОД] Отправляет подписку на баланс и ждет подтверждения.
   * @param timeout - Время ожидания в миллисекундах.
   */
  private sendBalancesSubscriptionAndAwaitConfirmation(
    timeout: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const time = Math.floor(Date.now() / 1000);
      const channel = "spot.balances";
      const event = "subscribe";

      const onMessage = (data: WebSocket.Data) => {
        const message = JSON.parse(data.toString());
        emitLog("INFO", `[SERVER] <= ${data.toString()}`);
        // Мы ожидаем ответ именно от нашего запроса на подписку
        if (
          message.channel === channel &&
          message.event === event &&
          message.time === time
        ) {
          cleanUp();
          resolve(message);
        }
      };

      const onError = (err: Error) => {
        cleanUp();
        reject(err);
      };

      const onTimeout = () => {
        cleanUp();
        reject(
          new Error(
            `Таймаут ожидания подтверждения подписки на баланс (${timeout}ms)`
          )
        );
      };

      const timer = setTimeout(onTimeout, timeout);

      const cleanUp = () => {
        clearTimeout(timer);
        this.ws?.removeListener("message", onMessage);
        this.ws?.removeListener("error", onError);
      };

      this.ws?.on("message", onMessage);
      this.ws?.once("error", onError);

      const request = {
        time: time,
        channel: channel,
        event: event,
        auth: genWsAuth(channel, event, time, this.apiKey, this.apiSecret),
      };
      this.sendMessage(request);
    });
  }

  /**
   * [НОВЫЙ МЕТОД-ОБЕРТКА] Логирует и отправляет сообщение.
   * @param message - Объект сообщения для отправки.
   */
  private sendMessage(message: object): void {
    const messageString = JSON.stringify(message);
    emitLog("INFO", `[CLIENT] => ${messageString}`);
    this.ws?.send(messageString);
  }

  /**
   * Запускает постоянные сервисы ПОСЛЕ успешного рукопожатия.
   */
  private startPermanentServices(): void {
    emitLog(
      "SUCCESS",
      "✅ Рукопожатие успешно. Бот переходит в рабочий режим."
    );
    eventBus.emit("connection:state", { state: "connected" });
    this.ws?.on("message", (data) => this.handleMessage(data));
    this.ws?.on("error", (err) =>
      emitLog("ERROR", `[WS Ошибка]: ${err.message}`)
    );
    this.ws?.on("close", () => this.onDisconnect());
    this.subscribeToTickers(["BTC_USDT", "ETH_USDT", "DOGE_USDT"]);
    this.setupPing();
  }

  /**
   * Обрабатывает сообщения в штатном режиме.
   */
  private handleMessage(data: WebSocket.Data): void {
    emitLog("INFO", `[SERVER] <= ${data.toString()}`);
    const message = JSON.parse(data.toString());

    if (message.channel === "spot.ping") {
      this.handlePing(message);
      return;
    }
    if (message.channel === "spot.balances" && message.event === "update") {
      // Первое сообщение после подписки содержит полный снэпшот,
      // а не только изменившиеся балансы.
      const results = Array.isArray(message.result)
        ? message.result
        : [message.result];
      const usdtBalance = (results as BalanceResult[]).find(
        (b) => b.currency === "USDT"
      );
      if (usdtBalance) {
        eventBus.emit("update:balance", {
          currency: "USDT",
          total: usdtBalance.available,
        });
      }
      return;
    }
    if (message.channel === "spot.tickers" && message.event === "update") {
      const result = message.result as TickerResult;
      eventBus.emit("update:price", {
        pair: result.currency_pair,
        price: result.last,
      });
    }
  }

  /**
   * Обрабатывает входящее Ping-сообщение от сервера.
   */
  private handlePing(pingMessage: GateioMessage<any>): void {
    const pongMessage = { time: pingMessage.time, channel: "spot.pong" };
    this.sendMessage(pongMessage);

    if (this.pingSentTime > 0) {
      const latency = Date.now() - this.pingSentTime;
      eventBus.emit("connection:pong", { latency });
      this.pingSentTime = 0;
    }
  }

  /**
   * (ЗАГЛУШКА) Асинхронный метод для создания торгового ордера.
   */
  public async createOrder(signal: TradeSignal): Promise<void> {
    /* ... код без изменений ... */
  }

  /**
   * Отправляет запрос на подписку на публичные каналы тикеров.
   */
  private subscribeToTickers(pairs: string[]): void {
    const message = {
      time: Math.floor(Date.now() / 1000),
      channel: "spot.tickers",
      event: "subscribe",
      payload: pairs,
    };
    this.sendMessage(message);
  }

  /**
   * Настраивает периодическую отправку ping-сообщений.
   */
  private setupPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      const message = {
        time: Math.floor(Date.now() / 1000),
        channel: "spot.ping",
      };
      this.sendMessage(message);
      this.pingSentTime = Date.now();
    }, 20000);
  }

  /**
   * Вызывается при закрытии соединения.
   */
  private onDisconnect(): void {
    /* ... код без изменений ... */
  }
}
