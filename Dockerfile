# Etape 1 : build
FROM node:24-alpine AS builder

WORKDIR /app

# Python + outils de build necessaires pour compiler argon2 (module natif)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

# Valeur factice, uniquement pour que prisma generate puisse se charger
# La vraie valeur sera fournie au runtime via les variables d'env de Render
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate
RUN npm run build

# Etape 2 : image finale, allegee
FROM node:24-alpine AS runner

WORKDIR /app

RUN apk add --no-cache python3 make g++

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/src/main.js"]