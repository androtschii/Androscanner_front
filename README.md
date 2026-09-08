# Androscanner — Frontend

Web-панель сетевого сканера. React + Vite + Tailwind CSS, работает поверх
[Androscanner_back](https://github.com/androtschii/Androscanner_back).

## Стек

- **Vite 8** + **React 19**
- **Tailwind CSS v4** (через `@tailwindcss/vite`, без отдельного конфига)
- **React Router 7**
- Запросы к API — нативный `fetch`, без axios

## Запуск

```bash
npm install
cp .env.example .env    # при необходимости поправь адрес API
npm run dev
```

Фронт поднимется на http://127.0.0.1:5173

**Важно:** бэкенд должен быть запущен на том адресе, что указан в `VITE_API_URL`
(по умолчанию http://127.0.0.1:8000), и этот origin фронта должен быть в
`CORS_ORIGINS` бэкенда — иначе браузер заблокирует запросы.

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `VITE_API_URL` | `http://127.0.0.1:8000` | Адрес backend API |

## Структура

```
src/
├── lib/api.js                 # обёртка над fetch, ApiError со статусом
├── context/AuthContext.jsx    # JWT + текущий пользователь
├── components/
│   └── ProtectedRoute.jsx     # редирект на /login без токена
├── pages/
│   ├── LoginPage.jsx          # POST /auth/login
│   └── ScansPage.jsx          # список сканов + запуск (по роли)
└── App.jsx                    # роутинг
```

## Как хранится токен

JWT живёт **только в памяти** React-контекста — ни `localStorage`, ни `sessionStorage`.
Обновление страницы разлогинивает: это осознанный выбор для security-инструмента,
токен нельзя украсть через XSS из хранилища браузера.

## Разграничение прав в UI

Меню и кнопки рендерятся по роли из `/users/me`:

| Элемент | admin | analyst | viewer |
|---|:---:|:---:|:---:|
| Список сканов | ✅ | ✅ | ✅ |
| Форма запуска скана | ✅ | ✅ | ❌ |

UI скрывает недоступное, но это **только удобство** — настоящая проверка прав
и allowed-scope живёт на бэкенде, обойти её через DevTools нельзя.

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер с HMR |
| `npm run build` | прод-сборка в `dist/` |
| `npm run preview` | локальный просмотр прод-сборки |
| `npm run lint` | oxlint |

## Дальше по плану

- Дашборд с графиками (Recharts): статистика по портам, сервисам, ОС
- Страница деталей скана: хосты, порты, сервисы
- Админка: пользователи и allowed scope
- Просмотр audit-log (admin)
