FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap traceroute curl wget git dnsutils whois netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml backend/poetry.lock* ./
RUN pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --no-root

COPY backend/ .
COPY server.py /app/server.py

RUN mkdir -p /app/workspace /tmp/rudrax_reports /tmp/rudrax_uploads /tmp/rudrax_chromadb

ENV PYTHONUNBUFFERED=1
ENV OLLAMA_BASE_URL=http://ollama:11434
ENV OLLAMA_URL=http://ollama:11434
ENV RUDRAX_WORKSPACE=/app/workspace

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
