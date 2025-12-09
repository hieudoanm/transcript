# Base image with Python 3.13.5 (or change to match your version)
FROM python:3.14.2

# Upgrade system packages to address vulnerabilities
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gcc \
    libffi-dev \
 && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Install uvicorn
RUN pip install uvicorn[standard]

# Expose port (FastAPI default via uvicorn)
EXPOSE 10000

# Command to run the app with live reload disabled (prod)
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "10000"]
