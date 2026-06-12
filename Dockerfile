FROM node:22-alpine
WORKDIR /app
COPY ais-proxy.js .
EXPOSE 3099
CMD ["node", "--experimental-websocket", "ais-proxy.js"]
