FROM mcr.microsoft.com/playwright:v1.51.0-jammy

WORKDIR /app

# Install deps
COPY services/scraper/package.json services/scraper/package-lock.json* ./
RUN npm install --omit=dev

# App code
COPY services/scraper/src ./src
COPY db/schema.sql ./db/schema.sql

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
