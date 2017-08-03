FROM node:8.2.1-alpine

RUN apk add --no-cache bash git

WORKDIR /app

RUN npm install -g nodemon

COPY package.json /app/package.json
RUN npm install && \
    mv /app/node_modules /node_modules

COPY . /app

VOLUME /etc/puppetlabs/code

CMD ["node", "./index.js"]
