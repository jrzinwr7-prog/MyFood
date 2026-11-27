FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm install --omit=dev && npm install typescript tsx --no-save
COPY . .
ENV NODE_ENV=production PORT=4000 DATABASE_PATH=/app/data/myfood.db
RUN mkdir -p /app/data
EXPOSE 4000
CMD ["node", "--experimental-sqlite", "node_modules/tsx/dist/cli.mjs", "apps/api/src/server.ts"]
