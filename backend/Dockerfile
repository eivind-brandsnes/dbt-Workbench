# =============================================================================
# dbt-Workbench – Backend
# Builds from ./backend i din fork av https://github.com/rezer-bleede/dbt-Workbench
# =============================================================================

FROM python:3.12-slim

# System-avhengigheter
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        gcc \
        g++ \
        gnupg2 \
        apt-transport-https \
        unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

# Microsoft ODBC Driver 18 – kreves av dbt-fabric
RUN curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/12/prod.list \
        > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Opprett datamapper – overstyres av volummontering i Container App
RUN mkdir -p /app/data/artifacts /app/data/repos /app/data/profiles

# Ikke kjør som root
RUN useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app
USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${BACKEND_PORT:-8000}/health || exit 1

EXPOSE 8000

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    BACKEND_PORT=8000 \
    DBT_ARTIFACTS_PATH=/app/data/artifacts \
    DBT_PROJECT_PATH=/app/data/repos/default \
    APP_ENV=production

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT} --workers 1 --no-access-log"]