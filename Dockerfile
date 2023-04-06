FROM node:18-alpine AS builder

WORKDIR /app

RUN apk update && \
    apk upgrade && \
    apk add \
    make \
    g++ \
    python3

COPY server/yarn.lock server/package.json ./

RUN yarn --production=true --frozen-lockfile --link-duplicates

FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV="production"

RUN apk update && \
    apk upgrade && \
    apk add --no-cache dumb-init

RUN mkdir /app/data && \
    chown -R node:node /app


COPY --chown=node:node --from=builder /app .
COPY --chown=node:node server/src/ src/
COPY --chown=node:node shared/ ../shared/

USER node:node

EXPOSE 3000/tcp

ENTRYPOINT [ "/usr/bin/dumb-init", "--" ]
CMD [ "node", "." ]