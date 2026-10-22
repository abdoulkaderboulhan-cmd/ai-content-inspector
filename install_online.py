# Prepares the project for going online (Render): requirements.txt, Dockerfile,
# small frontend/backend changes. Run from the project folder:  python install_online.py
from pathlib import Path

root = Path(__file__).resolve().parent

REQUIREMENTS = """fastapi==0.143.0
starlette==1.7.0
uvicorn==0.54.0
pydantic==2.14.0
email-validator==2.3.0
SQLAlchemy==2.1.4
bcrypt==5.0.0
PyJWT==2.15.1
python-multipart==0.0.32
joblib==1.6.0
numpy==2.4.6
scipy==1.17.1
scikit-learn==1.9.1
"""

DOCKERFILE = """# Stage 1: build the React website
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend that also serves the website
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY ml/baseline_model.joblib ./ml/baseline_model.joblib
COPY --from=web /web/dist ./frontend/dist
RUN mkdir -p data
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
"""

DOCKERIGNORE = """.git
.venv
**/node_modules
**/__pycache__
frontend/dist
data
*.parquet
*.csv
*.db
"""

STATIC_CODE = '''

# ---------- serve the built website (used when the app is online) ----------
from fastapi.responses import FileResponse as SiteFileResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

SITE_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if SITE_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=SITE_DIR / "assets"), name="site-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def website(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404, "Not found")
        candidate = SITE_DIR / full_path
        if full_path and candidate.is_file():
            return SiteFileResponse(candidate)
        return SiteFileResponse(SITE_DIR / "index.html")
'''


def write(rel, text):
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    print("created", rel)


def patch(rel, pairs):
    path = root / rel
    if not path.exists():
        print("MISSING", rel)
        return
    text = path.read_text(encoding="utf-8")
    changed = False
    for old, new in pairs:
        if old in text:
            text = text.replace(old, new, 1)
            changed = True
        elif new in text:
            print("  already done in", rel)
        else:
            print("  NOT FOUND in", rel, ":", old[:50])
    if changed:
        path.write_text(text, encoding="utf-8", newline="\n")
        print("updated", rel)


write("requirements.txt", REQUIREMENTS)
write("Dockerfile", DOCKERFILE)
write(".dockerignore", DOCKERIGNORE)

patch("frontend/src/api.js", [(
    'const BASE = "http://127.0.0.1:8000";',
    'export const BASE = import.meta.env.PROD ? "" : "http://127.0.0.1:8000";',
)])
patch("frontend/src/pages/Profile.jsx", [
    ('import { api } from "../api.js";', 'import { api, BASE } from "../api.js";'),
    ('const API = "http://127.0.0.1:8000";', 'const API = BASE;'),
])

main_path = root / "backend" / "main.py"
main_text = main_path.read_text(encoding="utf-8")
if "serve the built website" in main_text:
    print("backend/main.py already serves the website")
else:
    main_path.write_text(main_text.rstrip() + "\n" + STATIC_CODE, encoding="utf-8", newline="\n")
    print("updated backend/main.py")

print("DONE.")