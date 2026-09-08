const STATUS = {
  queued: { label: "в очереди", className: "bg-slate-700 text-slate-200" },
  running: { label: "выполняется", className: "bg-sky-900 text-sky-200" },
  done: { label: "готово", className: "bg-emerald-900 text-emerald-200" },
  failed: { label: "ошибка", className: "bg-red-900 text-red-200" },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] ?? { label: status, className: "bg-slate-700 text-slate-200" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
