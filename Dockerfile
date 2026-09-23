# Двухстадийная сборка: Node нужен только чтобы собрать статику,
# раздаёт её лёгкий nginx — тащить Node-рантайм в продакшен-образ незачем.

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Адрес API вшивается в JS-бандл на этапе сборки (Vite), поэтому это ARG,
# а не переменная окружения контейнера — после сборки её уже не поменять.
# По умолчанию — как настроено в docker-compose.yml бэкенда: api торчит
# на 127.0.0.1:8000 хоста, значит из браузера он виден как localhost.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
