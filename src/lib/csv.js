/**
 * Выгрузка таблиц в CSV.
 *
 * ВАЖНО про безопасность. Excel и LibreOffice трактуют значение,
 * начинающееся с = + - @ или табуляции, как ФОРМУЛУ. Имя хоста и баннер
 * сервиса приходят из сканируемой сети, то есть их содержимое выбирает
 * не пользователь. Хост с именем вроде
 *
 *     =cmd|'/c calc'!A1
 *
 * при открытии выгрузки попытается выполниться. Это называется
 * CSV-инъекцией, и для инструмента, который собирает данные из сети,
 * это реальный вектор, а не теория.
 *
 * Поэтому подозрительные значения предваряются апострофом — он делает
 * ячейку текстовой и не виден при просмотре.
 */

const FORMULA_STARTERS = ["=", "+", "-", "@", "\t", "\r"];

function neutralize(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.length > 0 && FORMULA_STARTERS.includes(text[0])) {
    return `'${text}`;
  }
  return text;
}

function escapeCell(value) {
  const text = neutralize(value);
  // Кавычки, запятые и переводы строк требуют обрамления кавычками,
  // а сами кавычки — удвоения (RFC 4180)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Собирает CSV.
 * @param columns [{ key, label, get? }]
 * @param rows массив объектов
 */
export function toCsv(columns, rows) {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(c.get ? c.get(row) : row[c.key])).join(","),
  );
  return [header, ...body].join("\r\n");
}

export function downloadCsv(filename, columns, rows) {
  const csv = toCsv(columns, rows);
  // BOM: без него Excel открывает UTF-8 как cp1251 и кириллица
  // превращается в кракозябры
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
