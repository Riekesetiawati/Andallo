FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY package.json package-lock.json ./
COPY server.js ./
COPY lib ./lib
COPY api ./api
COPY public ./public
COPY data ./data

RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
