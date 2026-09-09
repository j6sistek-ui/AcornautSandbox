FROM node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pil python3-numpy python3-scipy \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts --no-audit --no-fund
COPY . .
ENV ACORNAUT_TSC=/app/node_modules/typescript/lib/tsc.js
CMD ["sh", "-c", "npm run build && npm run gates"]
