import pytest

def test_upload_document(client):
    # This requires a mock file and depends on current_user
    # So we need to first register and login to get a token
    client.post(
        "/auth/register",
        json={"username": "uploaduser", "email": "upload@example.com", "password": "securepassword"}
    )
    login_res = client.post(
        "/auth/token",
        data={"username": "uploaduser", "password": "securepassword"}
    )
    token = login_res.json()["access_token"]
    
    # Mock a file upload
    response = client.post(
        "/document/upload",
        files=[("files", ("test.txt", b"Hello, this is a test document.", "text/plain"))],
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    assert "uploaded_files" in response.json()
    assert len(response.json()["uploaded_files"]) == 1
    assert response.json()["uploaded_files"][0]["filename"] == "test.txt"
    assert "task_id" in response.json()["uploaded_files"][0]
