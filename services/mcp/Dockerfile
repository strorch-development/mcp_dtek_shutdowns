FROM node:20-bookworm-slim

WORKDIR /app

COPY services/mcp/package.json services/mcp/package-lock.json* ./
RUN npm install --omit=dev

COPY services/mcp/src ./src
COPY db/schema.sql ./db/schema.sql

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
