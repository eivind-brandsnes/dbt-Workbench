# =============================================================================
# dbt-Workbench – Frontend
# Builds from ./frontend i din fork av https://github.com/rezer-bleede/dbt-Workbench
#
# VITE_API_BASE_URL må settes som build-arg så Vite baker den inn i bundlen.
# I Container App-en settes den til intern URL for backend Container App.
# =============================================================================

FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .

# VITE_API_BASE_URL bakes inn ved build-tid av Vite
# Settes via --build-arg i pipeline: f.eks. https://dbt-workbench-backend-dev.internal.azurecontainerapps.io
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build
# Output: /app/dist


# ── Serve med nginx ──────────────────────────────────────────────────────────
FROM nginx:alpine AS final

# Kopier ferdig-bygget frontend
COPY --from=build /app/dist /usr/share/nginx/html

# nginx-konfig som proxyer /api/* til backend og serverer SPA riktig
COPY nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]