FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Generate the Prisma client from the schema
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the source
COPY . .

EXPOSE 4000

# Migrate, seed if the DB is empty, then start
CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/seed.js && node src/index.js"]