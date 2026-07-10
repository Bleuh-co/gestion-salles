# syntax=docker/dockerfile:1.7
# Image multi-étages pour Next.js standalone — déployable sur Cloud Run

# ----- deps -----
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
# .npmrc pointe @bleuh-co vers GitHub Packages ; le token est injecté en
# secret de build BuildKit (id=gh_token) — jamais gravé dans l'image.
COPY package.json package-lock.json* .npmrc ./
RUN --mount=type=secret,id=gh_token \
    GITHUB_PACKAGES_TOKEN="$(cat /run/secrets/gh_token 2>/dev/null)" \
    npm ci --no-audit --no-fund

# ----- builder -----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Les variables NEXT_PUBLIC_* doivent être disponibles au BUILD (inlined).
# Défauts = PROD (antigravity + hub gandalf.chanv.com), overridés par
# cloudbuild.yaml au besoin.
ARG NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDIzsBK6Oq0Nzpe4WHXFHJ6cT3vVPMRlqY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=antigravity-20260107.firebaseapp.com
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=antigravity-20260107
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=antigravity-20260107.firebasestorage.app
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=271227085398
ARG NEXT_PUBLIC_FIREBASE_APP_ID=1:271227085398:web:default
ARG NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=chanv.com,bleuh.co,lafeuilleverte.ca,maisondherbes.com
ARG NEXT_PUBLIC_HUB_URL=https://chanv-apps-hub-271227085398.northamerica-northeast1.run.app
ARG NEXT_PUBLIC_APP_URL=https://gestion-salles.chanv.com
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=$NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS \
    NEXT_PUBLIC_HUB_URL=$NEXT_PUBLIC_HUB_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build

# ----- runner -----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
ENV PORT=8080
EXPOSE 8080
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
