import { useEffect } from "react";

/** Поля ввода: в них горячие клавиши мешали бы набирать текст. */
function isTyping(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
}

/**
 * Горячая клавиша.
 *
 * @param combo например "mod+k", "/", "Escape". mod — Ctrl на Windows/Linux
 *              и Cmd на macOS: одна запись работает на обеих платформах.
 * @param handler что делать
 * @param options.allowInInput разрешить срабатывание в полях ввода
 *                             (нужно для Escape, который закрывает поиск)
 */
export function useHotkey(combo, handler, { allowInInput = false, enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return;

    const parts = combo.toLowerCase().split("+");
    const key = parts.at(-1);
    const needsMod = parts.includes("mod");
    const needsShift = parts.includes("shift");

    function onKeyDown(e) {
      if (!allowInInput && isTyping(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;
      if (needsMod !== mod) return;
      if (needsShift !== e.shiftKey) return;
      if (e.key.toLowerCase() !== key) return;

      e.preventDefault();
      handler(e);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, handler, allowInInput, enabled]);
}

/** Подпись клавиши под платформой пользователя. */
export const MOD_LABEL =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
