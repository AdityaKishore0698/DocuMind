import os
import PyPDF2
from google import genai
from google.genai import types
from celery_app import celery_app
from database import SessionLocal
from models import Document, DocumentChunk
from langchain_text_splitters import RecursiveCharacterTextSplitter

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-2")
EMBEDDING_DIM = 768

_genai_client = None


def get_genai_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _genai_client

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
    result = get_genai_client().models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
    )
    return result.embeddings[0].values

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
