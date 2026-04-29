FROM node:20-bullseye-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN chown -R node:node /app

USER node
ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/server.js"]
