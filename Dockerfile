FROM node:10-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .
COPY .npmrc .
COPY jest.config.js .
COPY ./spec ./spec
COPY ./src ./src

ARG YG_NPM_TOKEN

RUN npm install
