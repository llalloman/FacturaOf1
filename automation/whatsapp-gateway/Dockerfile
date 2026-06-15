FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY index.js ./

EXPOSE 8081

CMD ["npm", "start"]