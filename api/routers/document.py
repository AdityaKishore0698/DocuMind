import os
import shutil
from typing import List
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from celery import Celery
from sqlalchemy.orm import Session
from core.database import get_db
from models.document import Document
from models.user import User
from core.dependencies import get_current_user

router = APIRouter()

celery_app = Celery("worker", broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0"))

@router.post("/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    shared_dir = "/shared"
    os.makedirs(shared_dir, exist_ok=True)
    
    results = []
    
    for file in files:
        file_path = os.path.join(shared_dir, f"{current_user.id}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        db_document = Document(filename=file.filename, status="uploaded", user_id=current_user.id)
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        
        task = celery_app.send_task("tasks.process_document", args=[db_document.id, file_path])
        results.append({"task_id": task.id, "document_id": db_document.id, "filename": file.filename})
        
    return {"uploaded_files": results}

@router.get("/")
def list_documents(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    return [{"id": d.id, "filename": d.filename, "status": d.status} for d in docs]

@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Also delete the underlying file from disk
    file_path = os.path.join("/shared", f"{current_user.id}_{doc.filename}")
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}
