// src/services/LogToFileService.ts

import * as fs from "fs";
import * as path from "path";
import { eventBus } from "./eventBus";
import { LogMessage } from "../types";

/**
 * Сервис, отвечающий за запись всех логов приложения в файл.
 */
export class LogToFileService {
  private logStream: fs.WriteStream;
  private readonly logFilePath: string;

  constructor(logFileName: string = "dtrader-crypto.log") {
    this.logFilePath = path.resolve(process.cwd(), logFileName);
    this.logStream = fs.createWriteStream(this.logFilePath, { flags: "a" });

    const startMessage = `--- Session started at ${new Date().toISOString()} ---\n`;
    this.logStream.write(startMessage);

    // --- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ---
    // Убираем console.log(), который мешал инициализации terminal-kit.
    // console.log(`[LogToFileService] Logging to file: ${this.logFilePath}`);
  }

  public startListening(): void {
    // После инициализации мы сразу отправим сообщение в EventBus.
    // Оно отобразится в UI и запишется в файл, когда все будет готово.
    eventBus.emit("log", {
      level: "INFO",
      message: `Логирование в файл: ${this.logFilePath}`,
    });

    eventBus.on("log", (logMessage: LogMessage) => {
      this.writeToFile(logMessage);
    });
  }

  private writeToFile(log: LogMessage): void {
    const timestamp = new Date().toISOString();
    const cleanMessage = log.message
      .replace(
        // eslint-disable-next-line no-control-regex
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        ""
      )
      .replace(/\^./g, "");
    const formattedMessage = `[${timestamp}] [${log.level.padEnd(
      7
    )}] ${cleanMessage}\n`;

    this.logStream.write(formattedMessage, (err) => {
      if (err) {
        // Если запись не удалась, выводим ошибку. Эта консоль уже "безопасна".
        console.error("Failed to write to log file:", err);
      }
    });
  }
}
