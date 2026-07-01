FROM node:20-alpine AS builder
WORKDIR /app

COPY frontend/package.json ./
RUN npm install

COPY frontend/tsconfig.json frontend/vite.config.ts frontend/postcss.config.js frontend/tailwind.config.js ./
COPY frontend/index.html ./
COPY frontend/src ./src
RUN npm run build

FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
