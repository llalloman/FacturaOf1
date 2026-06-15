FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --omit=dev

COPY index.js ./

EXPOSE 8081

CMD ["npm", "start"]