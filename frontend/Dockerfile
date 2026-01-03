# Этап сборки
FROM node:20 AS build

WORKDIR /app

# Копируем все зависимости и конфиги
COPY . .

# Устанавливаем зависимости
RUN npm install

# Копируем исходники клиента
COPY client/ ./client/

# Собираем проект
RUN npm run build

# Этап запуска
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

RUN mkdir -p /etc/nginx/ssl

# Копируем результат сборки (по умолчанию Vite создает dist в корне)
COPY --from=build /app/dist /usr/share/nginx/html

# Копируем наш конфиг nginx
COPY nginx.conf /etc/nginx/nginx.conf
RUN rm /etc/nginx/conf.d/default.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]