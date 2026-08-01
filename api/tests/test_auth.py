import pytest

def test_register_user(client):
    response = client.post(
        "/auth/register",
        json={"username": "testuser", "email": "test@example.com", "password": "securepassword"}
    )
    assert response.status_code == 200
    assert response.json() == {"message": "User registered successfully"}

def test_register_existing_user(client):
    response = client.post(
        "/auth/register",
        json={"username": "testuser", "email": "test2@example.com", "password": "securepassword"}
    )
    assert response.status_code == 400
    assert "Username already registered" in response.json()["detail"]

def test_login_success(client):
    response = client.post(
        "/auth/token",
        data={"username": "testuser", "password": "securepassword"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"

def test_login_failure(client):
    response = client.post(
        "/auth/token",
        data={"username": "testuser", "password": "wrongpassword"}
    )
    assert response.status_code == 401
