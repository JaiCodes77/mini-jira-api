"""Comprehensive CRUD tests for the /bugs endpoints."""

import pytest


# ── POST /bugs ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_bug_success(client, auth_headers):
    resp = await client.post(
        "/bugs",
        json={
            "title": "Test bug",
            "description": "desc",
            "status": "open",
            "priority": "high",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}"
    data = resp.json()
    assert "id" in data
    assert data["title"] == "Test bug"
    assert data["description"] == "desc"
    assert data["status"] == "open"
    assert data["priority"] == "high"
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_bug_minimal(client, auth_headers):
    resp = await client.post(
        "/bugs",
        json={"title": "Minimal"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}"
    data = resp.json()
    assert data["title"] == "Minimal"
    assert data["status"] == "open", "Default status should be 'open'"
    assert data["priority"] == "medium", "Default priority should be 'medium'"
    assert data["description"] is None, "Default description should be null"


@pytest.mark.asyncio
async def test_create_bug_no_auth(client):
    resp = await client.post(
        "/bugs",
        json={"title": "No auth bug"},
    )
    assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"


@pytest.mark.asyncio
async def test_create_bug_no_title(client, auth_headers):
    resp = await client.post(
        "/bugs",
        json={},
        headers=auth_headers,
    )
    assert resp.status_code == 422, f"Expected 422 for missing title, got {resp.status_code}"


# ── GET /bugs ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_bugs_empty(client):
    resp = await client.get("/bugs")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["limit"] == 20
    assert data["offset"] == 0


@pytest.mark.asyncio
async def test_list_bugs_returns_items(client, auth_headers):
    await client.post("/bugs", json={"title": "Bug 1"}, headers=auth_headers)
    await client.post("/bugs", json={"title": "Bug 2"}, headers=auth_headers)

    resp = await client.get("/bugs")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 2, f"Expected 2 items, got {len(data['items'])}"
    assert data["total"] == 2


@pytest.mark.asyncio
async def test_list_bugs_pagination(client, auth_headers):
    for i in range(3):
        await client.post("/bugs", json={"title": f"Bug {i}"}, headers=auth_headers)

    first_page = (await client.get("/bugs", params={"limit": 2, "offset": 0})).json()
    assert len(first_page["items"]) == 2, "First page should have 2 items"
    assert first_page["total"] == 3

    second_page = (await client.get("/bugs", params={"limit": 2, "offset": 2})).json()
    assert len(second_page["items"]) == 1, "Second page should have 1 item"
    assert second_page["total"] == 3


@pytest.mark.asyncio
async def test_list_bugs_filter_status(client, auth_headers):
    await client.post(
        "/bugs", json={"title": "Open bug", "status": "open"}, headers=auth_headers
    )
    await client.post(
        "/bugs",
        json={"title": "Closed bug", "status": "closed"},
        headers=auth_headers,
    )

    resp = await client.get("/bugs", params={"status": "open"})
    data = resp.json()
    assert all(
        b["status"] == "open" for b in data["items"]
    ), "All returned bugs should be open"
    assert data["total"] == 1


@pytest.mark.asyncio
async def test_list_bugs_filter_priority(client, auth_headers):
    await client.post(
        "/bugs",
        json={"title": "High bug", "priority": "high"},
        headers=auth_headers,
    )
    await client.post(
        "/bugs",
        json={"title": "Low bug", "priority": "low"},
        headers=auth_headers,
    )

    resp = await client.get("/bugs", params={"priority": "high"})
    data = resp.json()
    assert all(
        b["priority"] == "high" for b in data["items"]
    ), "All returned bugs should be high priority"
    assert data["total"] == 1


@pytest.mark.asyncio
async def test_list_bugs_search(client, auth_headers):
    await client.post("/bugs", json={"title": "Login page crash"}, headers=auth_headers)
    await client.post("/bugs", json={"title": "Signup issue"}, headers=auth_headers)

    resp = await client.get("/bugs", params={"q": "Login"})
    data = resp.json()
    assert data["total"] >= 1, "Search should find at least the matching bug"
    assert any(
        "Login" in b["title"] for b in data["items"]
    ), "Results should contain bug with 'Login' in title"


@pytest.mark.asyncio
async def test_list_bugs_sort(client, auth_headers):
    await client.post("/bugs", json={"title": "Banana"}, headers=auth_headers)
    await client.post("/bugs", json={"title": "Apple"}, headers=auth_headers)
    await client.post("/bugs", json={"title": "Cherry"}, headers=auth_headers)

    resp = await client.get("/bugs", params={"sort_by": "title", "order": "asc"})
    data = resp.json()
    titles = [b["title"] for b in data["items"]]
    assert titles == sorted(titles), f"Expected ascending order, got {titles}"


@pytest.mark.asyncio
async def test_list_bugs_no_auth_required(client, auth_headers):
    await client.post("/bugs", json={"title": "Visible bug"}, headers=auth_headers)

    resp = await client.get("/bugs")
    assert resp.status_code == 200, "GET /bugs should not require auth"
    assert resp.json()["total"] >= 1


# ── PATCH /bugs/{id} ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_bug_status(client, auth_headers, sample_bug):
    bug_id = sample_bug["id"]
    resp = await client.patch(
        f"/bugs/{bug_id}",
        json={"status": "closed"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "closed", "Status should be updated to closed"


@pytest.mark.asyncio
async def test_update_bug_priority(client, auth_headers, sample_bug):
    bug_id = sample_bug["id"]
    resp = await client.patch(
        f"/bugs/{bug_id}",
        json={"priority": "low"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["priority"] == "low", "Priority should be updated to low"


@pytest.mark.asyncio
async def test_update_bug_not_found(client, auth_headers):
    resp = await client.patch(
        "/bugs/99999",
        json={"status": "closed"},
        headers=auth_headers,
    )
    assert resp.status_code == 404, f"Expected 404 for missing bug, got {resp.status_code}"


@pytest.mark.asyncio
async def test_update_bug_no_auth(client, sample_bug):
    bug_id = sample_bug["id"]
    resp = await client.patch(
        f"/bugs/{bug_id}",
        json={"status": "closed"},
    )
    assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"


# ── DELETE /bugs/{id} ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_bug_success(client, auth_headers, sample_bug):
    bug_id = sample_bug["id"]
    resp = await client.delete(f"/bugs/{bug_id}", headers=auth_headers)
    assert resp.status_code == 204, f"Expected 204, got {resp.status_code}"


@pytest.mark.asyncio
async def test_delete_bug_not_found(client, auth_headers):
    resp = await client.delete("/bugs/99999", headers=auth_headers)
    assert resp.status_code == 404, f"Expected 404 for missing bug, got {resp.status_code}"


@pytest.mark.asyncio
async def test_delete_bug_no_auth(client, sample_bug):
    bug_id = sample_bug["id"]
    resp = await client.delete(f"/bugs/{bug_id}")
    assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"


@pytest.mark.asyncio
async def test_delete_bug_verify_gone(client, auth_headers, sample_bug):
    bug_id = sample_bug["id"]
    await client.delete(f"/bugs/{bug_id}", headers=auth_headers)

    resp = await client.get("/bugs")
    ids = [b["id"] for b in resp.json()["items"]]
    assert bug_id not in ids, f"Bug {bug_id} should no longer appear in list after deletion"
