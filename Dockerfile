FROM node:10-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .
COPY jest.config.js .
COPY ./spec ./spec
COPY ./src ./src

RUN npm install
