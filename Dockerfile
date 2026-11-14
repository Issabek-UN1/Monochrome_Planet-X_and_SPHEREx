FROM ghcr.io/astral-sh/uv:0.12.13 AS uv
FROM python:3.13-slim
COPY --from=uv /uv /uvx /bin/
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv PATH="/opt/venv/bin:$PATH" \
    SPHEREX_DATA_DIR=/app/data
WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
COPY backend/src ./backend/src
RUN uv sync --frozen --no-dev --no-editable \
    && useradd --create-home appuser \
    && mkdir -p /app/data && chown appuser:appuser /app/data
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=3)"
CMD ["uvicorn", "spherex.api:app", "--host", "0.0.0.0", "--port", "8000"]
