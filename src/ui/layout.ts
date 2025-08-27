// src/ui/layout.ts

const termkit = require("terminal-kit");

// Мы все еще извлекаем КОНСТРУКТОРЫ классов отсюда.
const Document = termkit.Document;
const TextBox = termkit.TextBox;
const Layout = termkit.Layout;
const Log = termkit.Log;
const SingleLineInput = termkit.SingleLineInput;
const Palette = termkit.Palette;

/**
 * Функция для создания основного макета интерфейса.
 * @param terminal - Гарантированно инициализированный экземпляр terminal-kit.
 */
export function createLayout(terminal: any) {
  // --- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ---
  // Мы используем тот `terminal`, который нам передали как аргумент.
  const document = new Document({
    // Явно передаем готовый экземпляр.
    term: terminal,
    palette: new Palette(),
  });

  // Все остальные обращения к свойствам (width, height, brightCyan)
  // теперь также идут через переданный `terminal`.
  const header = new TextBox({
    parent: document,
    x: 0,
    y: 0,
    width: terminal.width,
    height: 3,
    attr: { bgColor: terminal.brightCyan, color: "black" },
    content: `  ^+^bdtrader-crypto^: | Gate.io Trading Bot`,
    contentHasMarkup: true,
  });

  const statusWidget = new TextBox({
    parent: header,
    contentHasMarkup: true,
    x: terminal.width - 26,
    y: 1,
    width: 24,
    height: 1,
    attr: { bgColor: terminal.brightCyan },
    content: `^y... подключение^:`,
  });

  const mainContent = new Layout({
    parent: document,
    x: 0,
    y: 3,
    width: Math.floor(terminal.width * 0.65),
    height: terminal.height - 4,
    layout: {
      id: "main",
      y: 0,
      width: "100%",
      height: "100%",
      rows: [
        { id: "row1", heightPercent: 40 },
        { id: "row2", heightPercent: 60 },
      ],
    },
  });

  const sidebar = new Log({
    parent: document,
    x: mainContent.outputWidth,
    y: 3,
    width: terminal.width - mainContent.outputWidth,
    height: terminal.height - 4,
    autoScroll: true,
    vScrollBar: true,
    wordWrap: true,
  });

  const footer = new SingleLineInput({
    parent: document,
    x: 0,
    y: terminal.height - 1,
    width: terminal.width,
    height: 1,
    options: { prompt: "Команда: " },
  });

  return { document, mainContent, sidebar, footer, statusWidget };
}
