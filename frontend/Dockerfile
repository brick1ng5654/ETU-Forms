FROM node:20.18.3-alpine AS build

WORKDIR /app

# Install dependencies inside Linux container to avoid host platform binaries.
COPY package*.json ./
RUN npm ci

# Copy app sources after deps for better layer caching.
COPY . .
RUN npm run build

FROM nginx:1.27.3-alpine

RUN rm -rf /usr/share/nginx/html/*
RUN mkdir -p /etc/nginx/ssl

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
RUN rm /etc/nginx/conf.d/default.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]