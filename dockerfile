FROM node:20.10.0
WORKDIR /app

COPY package-lock.json package-lock.json
RUN npm install

COPY . .

ENTRYPOINT [ "npm","start" ]