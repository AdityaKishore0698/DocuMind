FROM python:3.11-slim

WORKDIR /app
ARG HTTP_PROXY
ARG HTTPS_PROXY

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["celery", "-A", "celery_app.celery_app", "worker", "--loglevel=info"]
