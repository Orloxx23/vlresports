FROM node:20
WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

ENTRYPOINT [ "npm","start" ]