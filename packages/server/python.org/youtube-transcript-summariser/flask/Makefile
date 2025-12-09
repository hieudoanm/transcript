format:
	python3 -m black .

check:
	python3 -m ruff check .

lock:
	python3 -m pigar generate

dev:
	gunicorn api.index:app -b 0.0.0.0:10000 --reload
