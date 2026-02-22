# Этап сборки
FROM node:20.18.3-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Собираем проект
RUN npm run build

# Этап запуска
FROM nginx:1.27.3-alpine

RUN rm -rf /usr/share/nginx/html/*

RUN mkdir -p /etc/nginx/ssl

# Копируем результат сборки (по умолчанию Vite создает dist в корне)
COPY --from=build /app/dist /usr/share/nginx/html

# Копируем наш конфиг nginx
COPY nginx.conf /etc/nginx/nginx.conf
RUN rm /etc/nginx/conf.d/default.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
