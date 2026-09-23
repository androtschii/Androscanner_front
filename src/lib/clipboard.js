/**
 * Обёртка над Clipboard API — отдельным модулем ради тестируемости:
 * navigator.clipboard в разных версиях jsdom ведёт себя по-разному
 * (то getter без сеттера, то отсутствует вовсе), мокать сам navigator
 * в тестах хрупко. Мокать этот модуль — нет.
 */
export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}
