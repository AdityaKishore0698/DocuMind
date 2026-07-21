import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends
from celery import Celery
from sqlalchemy.orm import Session
from core.database import get_db
from models.document import Document

router = APIRouter()

celery_app = Celery("worker", broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0"))

@router.post("/upload")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    shared_dir = "/shared"
    os.makedirs(shared_dir, exist_ok=True)
    
    file_path = os.path.join(shared_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    db_document = Document(filename=file.filename, status="uploaded")
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    task = celery_app.send_task("tasks.process_document", args=[db_document.id, file_path])
    
    return {"task_id": task.id, "document_id": db_document.id, "filename": file.filename}
