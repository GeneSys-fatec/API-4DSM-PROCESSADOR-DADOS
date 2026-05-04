from __future__ import annotations

import uvicorn

from app.config import settings


def main() -> None:
    uvicorn.run("app.api:app", host=settings.host, port=settings.port, reload=False)


if __name__ == "__main__":
    main()