from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1 import addresses, auth, cart, lottery, orders, products, profile
from app.api.v1.admin import router as admin_router
from app.core.config import get_settings
from app.db.session import engine

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth.router,
    products.router,
    cart.router,
    addresses.router,
    orders.router,
    lottery.router,
    profile.router,
):
    app.include_router(router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1/admin")


@app.get("/health")
@app.get("/api/v1/health")
def health() -> dict:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "environment": settings.app_env,
        "database": engine.dialect.name,
    }
