import json
import requests
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from core.database import get_db
from models.document import DocumentChunk

router = APIRouter()

class ChatRequest(BaseModel):
    query: str

def get_embedding(text: str):
    response = requests.post(
        "http://ollama:11434/api/embeddings",
        json={"model": "nomic-embed-text", "prompt": text}
    )
    response.raise_for_status()
    return response.json().get("embedding")

@router.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    query_embedding = get_embedding(request.query)
    
    results = db.query(DocumentChunk).order_by(
        DocumentChunk.embedding.cosine_distance(query_embedding)
    ).limit(5).all()
    
    context = "\n\n".join([chunk.content for chunk in results])
    
    def generate_response():
        prompt = f"Context:\n{context}\n\nQuery:\n{request.query}\n\nResponse:"
        response = requests.post(
            "http://ollama:11434/api/generate",
            json={"model": "llama3", "prompt": prompt, "stream": True},
            stream=True
        )
        for line in response.iter_lines():
            if line:
                data = json.loads(line)
                if not data.get("done"):
                    yield data.get("response", "")
                
    return StreamingResponse(generate_response(), media_type="text/plain")
