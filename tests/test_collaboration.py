import pytest

from app.routers.bugs import ATTACHMENTS_DIR


@pytest.fixture(autouse=True)
def cleanup_attachments():
    ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)
    for file_path in ATTACHMENTS_DIR.iterdir():
        if file_path.is_file():
            file_path.unlink()
    yield
    for file_path in ATTACHMENTS_DIR.iterdir():
        if file_path.is_file():
            file_path.unlink()


async def register_and_login(client, username, email, password="testpass123"):
    register_resp = await client.post(
        "/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
        },
    )
    assert register_resp.status_code == 201

    login_resp = await client.post(
        "/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_resp.status_code == 200
    payload = login_resp.json()
    return {
        "headers": {"Authorization": f"Bearer {payload['access_token']}"},
        "user_id": payload["user_id"],
        "username": payload["username"],
    }


async def create_project(client, headers, name="Collab", key="CLB"):
    response = await client.post(
        "/projects",
        json={"name": name, "key": key},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


async def create_bug(client, headers, payload):
    response = await client.post("/bugs", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


async def test_issue_watch_link_activity_and_notifications_flow(client):
    owner = await register_and_login(client, "notify_owner", "notify-owner@example.com")
    teammate = await register_and_login(client, "notify_peer", "notify-peer@example.com")
    observer = await register_and_login(client, "notify_observer", "notify-observer@example.com")
    project = await create_project(client, owner["headers"], name="Notifications", key="NTF")

    primary_bug = await create_bug(
        client,
        owner["headers"],
        {
            "title": "Primary issue",
            "description": "Needs collaboration features",
            "project_id": project["id"],
        },
    )
    secondary_bug = await create_bug(
        client,
        owner["headers"],
        {
            "title": "Secondary issue",
            "project_id": project["id"],
        },
    )

    assign_resp = await client.patch(
        f"/bugs/{primary_bug['id']}",
        json={
            "title": primary_bug["title"],
            "assignee_id": teammate["user_id"],
            "story_points": 5,
        },
        headers=owner["headers"],
    )
    assert assign_resp.status_code == 200

    watch_resp = await client.post(
        f"/bugs/{primary_bug['id']}/watch",
        headers=observer["headers"],
    )
    assert watch_resp.status_code == 200

    link_resp = await client.post(
        f"/bugs/{primary_bug['id']}/links",
        json={
            "target_bug_id": secondary_bug["id"],
            "link_type": "blocks",
        },
        headers=owner["headers"],
    )
    assert link_resp.status_code == 201

    detail_resp = await client.get(f"/bugs/{primary_bug['id']}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()

    assert detail["assignee"]["id"] == teammate["user_id"]
    assert detail["story_points"] == 5
    assert any(watcher["id"] == teammate["user_id"] for watcher in detail["watchers"])
    assert any(watcher["id"] == observer["user_id"] for watcher in detail["watchers"])
    assert detail["watch_count"] >= 1
    assert any(link["bug"]["id"] == secondary_bug["id"] for link in detail["links"])

    activity_resp = await client.get(f"/bugs/{primary_bug['id']}/activity?limit=20&offset=0")
    assert activity_resp.status_code == 200
    activity_types = {item["event_type"] for item in activity_resp.json()["items"]}
    assert "issue_updated" in activity_types
    assert "watcher_added" in activity_types
    assert "issue_link_added" in activity_types

    notifications_resp = await client.get(
        "/notifications?limit=20&offset=0",
        headers=teammate["headers"],
    )
    assert notifications_resp.status_code == 200
    notifications = notifications_resp.json()["items"]
    assert any(
        notification["notification_type"] == "assignment"
        and notification["bug_id"] == primary_bug["id"]
        for notification in notifications
    )


async def test_comment_mentions_editing_and_attachment_flow(client):
    owner = await register_and_login(client, "mention_owner", "mention-owner@example.com")
    teammate = await register_and_login(client, "comment_peer", "comment-peer@example.com")
    project = await create_project(client, owner["headers"], name="Comments", key="CMT")
    bug = await create_bug(
        client,
        owner["headers"],
        {
            "title": "Comment target",
            "project_id": project["id"],
        },
    )

    comment_resp = await client.post(
        f"/bugs/{bug['id']}/comments",
        json={"body": f"Please review this, @{owner['username']}"},
        headers=teammate["headers"],
    )
    assert comment_resp.status_code == 201
    comment = comment_resp.json()
    assert comment["author"]["username"] == teammate["username"]
    assert [user["username"] for user in comment["mentioned_users"]] == [owner["username"]]

    edit_resp = await client.patch(
        f"/bugs/{bug['id']}/comments/{comment['id']}",
        json={"body": "Updated comment body"},
        headers=teammate["headers"],
    )
    assert edit_resp.status_code == 200
    assert edit_resp.json()["body"] == "Updated comment body"

    comments_resp = await client.get(f"/bugs/{bug['id']}/comments?limit=20&offset=0")
    assert comments_resp.status_code == 200
    comments_payload = comments_resp.json()
    assert comments_payload["total"] == 1
    assert comments_payload["items"][0]["author"]["username"] == teammate["username"]

    notifications_resp = await client.get(
        "/notifications?limit=20&offset=0",
        headers=owner["headers"],
    )
    assert notifications_resp.status_code == 200
    notifications = notifications_resp.json()["items"]
    assert any(
        notification["notification_type"] == "mention"
        and notification["bug_id"] == bug["id"]
        for notification in notifications
    )

    upload_resp = await client.post(
        f"/bugs/{bug['id']}/attachments",
        headers=owner["headers"],
        files={"file": ("notes.txt", b"attachment-body", "text/plain")},
    )
    assert upload_resp.status_code == 201
    attachment = upload_resp.json()
    stored_files = [file_path for file_path in ATTACHMENTS_DIR.iterdir() if file_path.is_file()]
    assert len(stored_files) == 1

    detail_resp = await client.get(f"/bugs/{bug['id']}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert [item["id"] for item in detail["attachments"]] == [attachment["id"]]

    download_resp = await client.get(attachment["download_url"])
    assert download_resp.status_code == 200
    assert download_resp.content == b"attachment-body"

    delete_resp = await client.delete(
        f"/bugs/{bug['id']}/attachments/{attachment['id']}",
        headers=owner["headers"],
    )
    assert delete_resp.status_code == 204
    assert not any(file_path.is_file() for file_path in ATTACHMENTS_DIR.iterdir())
