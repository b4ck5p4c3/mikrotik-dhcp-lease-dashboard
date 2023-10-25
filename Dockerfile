FROM node:20-alpine
WORKDIR /app
COPY . .
RUN yarn --pure-lockfile
CMD yarn start