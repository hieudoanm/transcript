format:
	python3 -m black .

check:
	python3 -m ruff check .

lock:
	python3 -m pigar generate

dev:
	uvicorn app.main:app --host 0.0.0.0 --port 10000 --reload