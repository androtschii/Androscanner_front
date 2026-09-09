import { Component } from "react";

/**
 * Перехватывает ошибки рендера, чтобы страница не белела молча.
 *
 * Класс, а не хук: перехват ошибок рендера в React возможен только
 * через componentDidCatch — хуковой замены ему нет.
 *
 * Ошибку показываем текстом. Пользователь этого сканера — тот же человек,
 * который его и запускает: спрятать причину под «что-то пошло не так»
 * значило бы заставить его лезть в консоль за тем, что можно показать сразу.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Оставляем след в консоли: stack trace нужен при разборе
    console.error("Ошибка рендера:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-lg rounded-xl border border-red-900 bg-slate-900 p-6">
          <h1 className="mb-2 text-lg font-semibold text-red-300">
            Страница не отрисовалась
          </h1>
          <p className="mb-4 text-sm text-slate-400">
            Это ошибка в интерфейсе, а не в результатах сканирования — данные
            в базе не пострадали.
          </p>

          <pre className="mb-4 max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
            {error.message || String(error)}
          </pre>

          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Попробовать снова
            </button>
            <button
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              На дашборд
            </button>
          </div>
        </div>
      </div>
    );
  }
}
