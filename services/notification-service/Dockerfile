# Use a lightweight, current Node LTS base image
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

USER node

EXPOSE 3504

CMD ["node", "server.js"]
