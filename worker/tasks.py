import os
import requests
import PyPDF2
from celery_app import celery_app
from database import SessionLocal
from models import Document, DocumentChunk
from langchain_text_splitters import RecursiveCharacterTextSplitter

OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://ollama:11434/api/embeddings")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "nomic-embed-text")

def extract_text(filepath: str) -> str:
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()
    if ext == ".pdf":
        text = ""
        with open(filepath, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        return text
    else:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()

def get_embedding(text: str) -> list[float]:
    response = requests.post(
        OLLAMA_API_URL,
        json={"model": OLLAMA_MODEL, "prompt": text}
    )
    response.raise_for_status()
    return response.json()["embedding"]

@celery_app.task
def process_document(document_id: int, filename: str):
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return f"Document {document_id} not found"

        doc.status = "processing"
        db.commit()

        filepath = os.path.join("/shared", filename)
        if not os.path.exists(filepath):
            doc.status = "failed"
            db.commit()
            return f"File {filepath} not found"

        text = extract_text(filepath)
        
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = splitter.split_text(text)
        
        for chunk_text in chunks:
            embedding = get_embedding(chunk_text)
            
            chunk_record = DocumentChunk(
                document_id=document_id,
                content=chunk_text,
                embedding=embedding
            )
            db.add(chunk_record)
        
        doc.status = "completed"
        db.commit()
        
        return f"Document {document_id} processed successfully"
    except Exception as e:
        db.rollback()
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.status = "failed"
            db.commit()
        raise e
    finally:
        db.close()
