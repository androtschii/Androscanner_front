import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Подтверждение необратимого действия.
 *
 * До этого «Отключить пользователя» и «Удалить диапазон» срабатывали
 * мгновенно по одному клику. Для инструмента, где удаление диапазона
 * отзывает доступ к сканированию сети, это слишком легко сделать
 * случайно.
 *
 * Нативный <dialog> вместо самодельного оверлея: он сам даёт фокус-ловушку,
 * закрытие по Escape и затемнение фона через ::backdrop. Городить это
 * руками — значит повторять то, что браузер уже умеет.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Escape и клик по фону закрывают диалог — оба должны вести себя
  // как «Отмена», а не как молчаливое исчезновение
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onCancel?.();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onCancel]);

  function handleBackdropClick(e) {
    if (e.target === ref.current) onCancel?.();
  }

  return (
    <dialog
      ref={ref}
      onClick={handleBackdropClick}
      className="max-w-md rounded-xl border border-slate-700 bg-slate-900 p-0 text-slate-100 backdrop:bg-slate-950/70"
    >
      <div className="p-5">
        <div className="mb-3 flex items-start gap-3">
          <AlertTriangle
            className={danger ? "shrink-0 text-red-400" : "shrink-0 text-amber-400"}
            size={20}
            aria-hidden="true"
          />
          <h2 className="font-semibold">{title}</h2>
        </div>

        <p className="mb-5 text-sm text-slate-300">{message}</p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={
              danger
                ? "rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                : "rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
