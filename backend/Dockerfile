FROM python:3.11-slim

# System deps for psycopg2, Pillow, cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc libffi-dev libssl-dev libjpeg-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create the static directory if it doesn't exist
RUN mkdir -p static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
