async def test_register_success(client):
    resp = await client.post(
        "/auth/register",
        json={
            "username": "reg_success_user",
            "email": "reg_success@example.com",
            "password": "testpass123",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["username"] == "reg_success_user"
    assert data["email"] == "reg_success@example.com"
    assert data["is_active"] is True


async def test_register_duplicate_username(client):
    payload = {
        "username": "dup_user",
        "email": "dup_user_1@example.com",
        "password": "testpass123",
    }
    await client.post("/auth/register", json=payload)

    resp = await client.post(
        "/auth/register",
        json={**payload, "email": "dup_user_2@example.com"},
    )
    assert resp.status_code == 409


async def test_register_duplicate_email(client):
    payload = {
        "username": "dup_email_1",
        "email": "dup_email@example.com",
        "password": "testpass123",
    }
    await client.post("/auth/register", json=payload)

    resp = await client.post(
        "/auth/register",
        json={**payload, "username": "dup_email_2"},
    )
    assert resp.status_code == 409


async def test_login_success(client):
    await client.post(
        "/auth/register",
        json={
            "username": "login_ok_user",
            "email": "login_ok@example.com",
            "password": "testpass123",
        },
    )

    resp = await client.post(
        "/auth/login",
        data={"username": "login_ok_user", "password": "testpass123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert isinstance(data["user_id"], int)
    assert data["username"] == "login_ok_user"


async def test_login_wrong_password(client):
    await client.post(
        "/auth/register",
        json={
            "username": "wrong_pw_user",
            "email": "wrong_pw@example.com",
            "password": "testpass123",
        },
    )

    resp = await client.post(
        "/auth/login",
        data={"username": "wrong_pw_user", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


async def test_login_nonexistent_user(client):
    resp = await client.post(
        "/auth/login",
        data={"username": "ghost_user", "password": "whatever"},
    )
    assert resp.status_code == 401
