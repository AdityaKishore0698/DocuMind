from fastapi import FastAPI
from core.database import engine, Base
import models.document
import models.user
from routers import document, chat, auth

from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.commit()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DocuMind API")

app.include_router(auth.router, tags=["auth"], prefix="/auth")
app.include_router(document.router, tags=["document"], prefix="/document")
app.include_router(chat.router, tags=["chat"], prefix="/chat")

@app.get("/")
def read_root():
    return {"message": "DocuMind API is running"}
