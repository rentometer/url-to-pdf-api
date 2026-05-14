# Local-dev image for url-to-pdf-api. Heroku still builds via the
# puppeteer-heroku-buildpack defined in app.json; this Dockerfile only exists
# so the service can be exercised against rentometer2 in dev.
FROM node:16-bullseye-slim

# Use Debian's Chromium instead of Puppeteer's bundled binary. Puppeteer 18
# doesn't ship a linux-arm64 Chromium, so on Apple-silicon hosts the bundled
# download fails. The OS package is multi-arch and works under both arm64 and
# amd64 without going through Rosetta.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      chromium \
      fonts-liberation \
      wget \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Tell Puppeteer to use the system Chromium and not attempt a download during
# `npm ci`. PUPPETEER_EXECUTABLE_PATH is also read at runtime by the launcher.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json package-lock.json ./
# --legacy-peer-deps: eslint-config-airbnb-base@15 caps at eslint 8 but the
# devDeps pin eslint@10. The conflict is dev-only (lint); keep the lockfile as
# resolved on the host.
RUN npm ci --legacy-peer-deps

COPY src ./src

ENV PORT=9000
EXPOSE 9000

CMD ["node", "src/index.js"]
