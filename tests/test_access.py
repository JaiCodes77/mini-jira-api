"""Auth hardening, project membership, and aggregate summary."""

from tests.test_projects import create_bug, create_project, register_and_login


async def test_register_rejects_weak_password_and_bad_email(client):
    short = await client.post(
        "/auth/register",
        json={"username": "weakuser", "email": "weak@example.com", "password": "short"},
    )
    assert short.status_code == 422

    bad_email = await client.post(
        "/auth/register",
        json={"username": "bademail", "email": "not-an-email", "password": "testpass123"},
    )
    assert bad_email.status_code == 422


async def test_inactive_user_cannot_login(client, deactivate_user):
    await client.post(
        "/auth/register",
        json={"username": "inactive_user", "email": "inactive@example.com", "password": "testpass123"},
    )
    deactivate_user("inactive_user")

    resp = await client.post(
        "/auth/login",
        data={"username": "inactive_user", "password": "testpass123"},
    )
    assert resp.status_code == 401


async def test_project_key_must_look_like_a_key(client):
    owner = await register_and_login(client, "key_owner", "key-owner@example.com")
    resp = await client.post(
        "/projects",
        json={"name": "Bad", "key": "1"},
        headers=owner["headers"],
    )
    assert resp.status_code == 422


async def test_membership_gates_reads_and_writes(client):
    owner = await register_and_login(client, "access_owner", "access-owner@example.com")
    member = await register_and_login(client, "access_member", "access-member@example.com")
    viewer = await register_and_login(client, "access_viewer", "access-viewer@example.com")
    outsider = await register_and_login(client, "access_outsider", "access-outsider@example.com")
    project = await create_project(client, owner["headers"], "Access", "ACC")

    hidden = await client.get(f"/projects/{project['id']}", headers=outsider["headers"])
    assert hidden.status_code == 403

    outsider_list = await client.get("/projects?limit=100", headers=outsider["headers"])
    assert all(item["id"] != project["id"] for item in outsider_list.json()["items"])

    invite_member = await client.post(
        f"/projects/{project['id']}/members",
        json={"username": member["username"], "role": "member"},
        headers=owner["headers"],
    )
    assert invite_member.status_code == 201
    invite_viewer = await client.post(
        f"/projects/{project['id']}/members",
        json={"username": viewer["username"], "role": "viewer"},
        headers=owner["headers"],
    )
    assert invite_viewer.status_code == 201

    created = await create_bug(
        client,
        member["headers"],
        {"title": "Member issue", "priority": "high", "project_id": project["id"]},
    )
    assert created["issue_key"] == f"ACC-{created['id']}"

    viewer_create = await client.post(
        "/bugs",
        json={"title": "Viewer should fail", "project_id": project["id"]},
        headers=viewer["headers"],
    )
    assert viewer_create.status_code == 403

    summary = await client.get(f"/bugs/summary?project_id={project['id']}", headers=owner["headers"])
    assert summary.status_code == 200
    body = summary.json()
    assert body["total"] == 1
    assert body["open"] == 1
    assert body["high_priority"] == 1
    assert body["unassigned"] == 1

    remove_owner = await client.delete(
        f"/projects/{project['id']}/members/{owner['user_id']}",
        headers=owner["headers"],
    )
    assert remove_owner.status_code == 400


async def test_attachment_type_and_preferences(client, auth_headers):
    created = await client.post("/bugs", json={"title": "Files"}, headers=auth_headers)
    bug_id = created.json()["id"]

    rejected = await client.post(
        f"/bugs/{bug_id}/attachments",
        headers=auth_headers,
        files={"file": ("payload.exe", b"nope", "application/octet-stream")},
    )
    assert rejected.status_code == 400

    me = await client.get("/auth/me", headers=auth_headers)
    assert me.status_code == 200
    assert me.json()["in_app_notifications"] is True

    updated = await client.patch(
        "/auth/me/preferences",
        json={"in_app_notifications": False},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["in_app_notifications"] is False
