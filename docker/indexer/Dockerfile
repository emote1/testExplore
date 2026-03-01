FROM node:20-alpine

# Install postgresql-client for init script
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm install -D typescript tsx @types/pg && npm run build

# Remove dev dependencies
RUN npm prune --production

# Copy init script
COPY init-cursor.sh /app/init-cursor.sh
RUN chmod +x /app/init-cursor.sh

# Run the indexer with init script
CMD ["/app/init-cursor.sh"]
