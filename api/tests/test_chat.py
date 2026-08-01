import pytest
from unittest.mock import patch

@patch("routers.chat.requests.post")
def test_create_session(mock_post, client):
    client.post(
        "/auth/register",
        json={"username": "chatuser", "email": "chat@example.com", "password": "securepassword"}
    )
    login_res = client.post(
        "/auth/token",
        data={"username": "chatuser", "password": "securepassword"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test session creation
    res = client.post("/chat/sessions", json={"title": "Test Session"}, headers=headers)
    assert res.status_code == 200
    assert "id" in res.json()
    assert res.json()["title"] == "Test Session"
    
    # Test listing sessions
    res2 = client.get("/chat/sessions", headers=headers)
    assert res2.status_code == 200
    assert len(res2.json()) == 1
    assert res2.json()[0]["title"] == "Test Session"
