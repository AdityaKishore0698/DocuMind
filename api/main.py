from fastapi import FastAPI
from core.database import engine, Base
import models.document
from routers import document, chat

from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.commit()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Multimodal RAG Engine API")

app.include_router(document.router, tags=["document"])
app.include_router(chat.router, tags=["chat"])

@app.get("/")
def read_root():
    return {"message": "Multimodal RAG Engine API is running"}
