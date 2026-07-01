FROM node:20-alpine AS builder
WORKDIR /app

COPY backend/package.json ./
RUN npm install

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY backend/package.json ./package.json
RUN npm install --production

ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
