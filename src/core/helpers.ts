/**
 * Хелпер для форматирования числовых значений в красивую строку.
 * @param num - Число или строка для форматирования.
 * @param fractionDigits - Количество знаков после запятой.
 * @returns Отформатированная строка, например "1 234.5678"
 */
export function formatNumber(
  num: number | string,
  fractionDigits: number
): string {
  const number = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(number)) return "N/A";

  const fixed = number.toFixed(fractionDigits);
  const parts = fixed.split(".");
  // Добавляем пробел как разделитель тысяч с помощью регулярного выражения.
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.join(".");
}
