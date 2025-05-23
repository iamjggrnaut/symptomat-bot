FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install -g pm2
COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --production

CMD ["pm2-runtime", "dist/app.js"]