import pytest
from unittest.mock import MagicMock, patch


@patch("routers.document.celery_app.send_task")
@patch("routers.document.get_supabase")
def test_upload_document(mock_get_supabase, mock_send_task, client):
    # Storage upload and Celery enqueue are external — stub them out.
    mock_get_supabase.return_value = MagicMock()
    mock_send_task.return_value = MagicMock(id="test-task-id")

    # Register + login to get a token
    client.post(
        "/auth/register",
        json={"username": "uploaduser", "email": "upload@example.com", "password": "securepassword"}
    )
    login_res = client.post(
        "/auth/token",
        data={"username": "uploaduser", "password": "securepassword"}
    )
    token = login_res.json()["access_token"]

    response = client.post(
        "/document/upload",
        files=[("files", ("test.txt", b"Hello, this is a test document.", "text/plain"))],
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert "uploaded_files" in response.json()
    assert len(response.json()["uploaded_files"]) == 1
    assert response.json()["uploaded_files"][0]["filename"] == "test.txt"
    assert response.json()["uploaded_files"][0]["task_id"] == "test-task-id"

    # The file bytes were pushed to the "documents" bucket, not local disk.
    mock_get_supabase.return_value.storage.from_.assert_called_with("documents")
    mock_send_task.assert_called_once()
