# Базовый образ
FROM node:20

# Рабочая директория внутри контейнера
WORKDIR /app/front

# Копируем package.json и package-lock.json
COPY front/package*.json ./

# Копируем локальные пакеты SurveyJS
COPY surveyjs/ ../../surveyjs/

# Устанавливаем зависимости, включая локальные пакеты
RUN npm install

# Копируем весь фронтенд код
COPY front/ ./

# Собираем фронтенд
RUN npm run build

# Команда запуска dev-сервера
CMD ["npm", "run", "dev"]
