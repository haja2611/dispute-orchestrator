FROM node:20-alpine

# Install libaio required by Oracle Instant Client thin mode (not needed for thin driver)
# oracledb v6 uses the thin driver by default — no Instant Client needed
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 3000

# Run as non-root for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["node", "src/server.js"]
