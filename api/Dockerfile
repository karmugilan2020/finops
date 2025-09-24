FROM node:20-alpine
WORKDIR /app
COPY api/package.json ./
RUN npm install --omit=dev
COPY api/server.js api/db.js api/migrate.js ./
# now that build context is repo root, copy from root paths (no “..”)
COPY migrations ./migrations
EXPOSE 8080
CMD sh -lc "node migrate.js && node server.js"

