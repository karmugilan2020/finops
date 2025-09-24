FROM node:20-alpine
WORKDIR /app
COPY worker/package.json ./
RUN npm install --omit=dev
COPY worker/src ./src
# copy policies from root (no “..” anymore)
COPY policies ./policies
ENV NODE_ENV=production
EXPOSE 9999
CMD ["node", "src/index.js"]

