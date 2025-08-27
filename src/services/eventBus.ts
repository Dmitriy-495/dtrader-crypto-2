/**
 * Реализация паттерна "Шина событий" (EventBus).
 * Это ключевой элемент архитектуры, который позволяет различным частям
 * приложения общаться друг с другом, не имея прямых ссылок друг на друга (слабая связность).
 * Например, сервис Gate.io генерирует событие 'update:price', а UI-компонент
 * подписывается на него и обновляет интерфейс.
 */

type EventCallback = (...args: any[]) => void;

class EventBus {
  private events: { [key: string]: EventCallback[] } = {};

  public on(event: string, callback: EventCallback): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  public emit(event: string, ...args: any[]): void {
    if (this.events[event]) {
      this.events[event].forEach((callback) => callback(...args));
    }
  }
}

export const eventBus = new EventBus();
