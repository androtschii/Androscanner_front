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
 *
 * Разделитель — ";", а не ",". У Excel нет единого формата CSV: при
 * открытии двойным кликом он режет строку по региональному разделителю
 * списков Windows, а в русской локали это ";", не ",". Директива
 * "sep=," в первой строке должна была бы это обходить, но на практике
 * в сочетании с UTF-16 (см. ниже) она ломает уже кодировку — поэтому
 * проще сразу писать тем разделителем, который эта локаль ждёт.
 */

const DELIMITER = ";";
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
  // Кавычки, разделитель и переводы строк требуют обрамления кавычками,
  // а сами кавычки — удвоения (RFC 4180)
  if (text.includes('"') || text.includes(DELIMITER) || /[\n\r]/.test(text)) {
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
  const header = columns.map((c) => escapeCell(c.label)).join(DELIMITER);
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(c.get ? c.get(row) : row[c.key])).join(DELIMITER),
  );
  return [header, ...body].join("\r\n");
}

// UTF-16LE, а не UTF-8 + BOM: на этой локали Excel всё равно читает
// UTF-8 как cp1251, BOM это не спасает. 2-байтовый BOM UTF-16 (FF FE)
// Excel определяет однозначно независимо от локали. Проверено вручную:
// UTF-8+BOM — кракозябры; UTF-16LE+BOM — кириллица читается корректно.
function encodeUtf16Le(text) {
  const bytes = new Uint8Array(text.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(i * 2, text.charCodeAt(i), true);
  }
  return bytes;
}

export function downloadCsv(filename, columns, rows) {
  const csv = toCsv(columns, rows);
  const bytes = encodeUtf16Le("﻿" + csv);
  const blob = new Blob([bytes], { type: "text/csv;charset=utf-16le" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
