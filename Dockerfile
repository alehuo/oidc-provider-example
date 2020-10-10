FROM node:10.19-alpine

WORKDIR /app

COPY package*.json .eslintrc.js tsconfig.json ./

RUN npm install

COPY src ./src
COPY views ./views
RUN npm run build

CMD ["node", "dist/index.js"]