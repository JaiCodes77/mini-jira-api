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


async def create_project(client, headers, name, key):
    response = await client.post(
        "/projects",
        json={"name": name, "key": key},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


async def create_project_record(client, headers, project_id, resource, payload):
    response = await client.post(
        f"/projects/{project_id}/{resource}",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


async def create_bug(client, headers, payload):
    response = await client.post("/bugs", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


async def test_project_owner_controls_project_updates_and_catalog_permissions(client):
    owner = await register_and_login(client, "project_owner", "project-owner@example.com")
    teammate = await register_and_login(client, "project_peer", "project-peer@example.com")
    project = await create_project(client, owner["headers"], "Atlas", "ATL")

    update_resp = await client.patch(
        f"/projects/{project['id']}",
        json={"name": "Atlas Prime", "key": "ATX"},
        headers=owner["headers"],
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["key"] == "ATX"

    forbidden_resp = await client.post(
        f"/projects/{project['id']}/epics",
        json={"name": "Unauthorized epic"},
        headers=teammate["headers"],
    )
    assert forbidden_resp.status_code == 403

    delete_resp = await client.delete(
        f"/projects/{project['id']}",
        headers=teammate["headers"],
    )
    assert delete_resp.status_code == 403


async def test_issue_can_move_between_projects_with_project_scoped_metadata(client):
    owner = await register_and_login(client, "catalog_owner", "catalog-owner@example.com")

    project_a = await create_project(client, owner["headers"], "Roadmap", "RDM")
    project_b = await create_project(client, owner["headers"], "Delivery", "DLV")

    epic_a = await create_project_record(
        client,
        owner["headers"],
        project_a["id"],
        "epics",
        {"name": "Roadmap epic"},
    )
    label_a = await create_project_record(
        client,
        owner["headers"],
        project_a["id"],
        "labels",
        {"name": "frontend", "color": "#7C3AED"},
    )
    epic_b = await create_project_record(
        client,
        owner["headers"],
        project_b["id"],
        "epics",
        {"name": "Delivery epic"},
    )
    label_b = await create_project_record(
        client,
        owner["headers"],
        project_b["id"],
        "labels",
        {"name": "backend", "color": "#2563EB"},
    )

    created_bug = await create_bug(
        client,
        owner["headers"],
        {
            "title": "Scoped issue",
            "description": "Moves between project catalogs",
            "project_id": project_a["id"],
            "epic_id": epic_a["id"],
            "label_ids": [label_a["id"]],
        },
    )
    assert created_bug["project_id"] == project_a["id"]
    assert created_bug["epic_id"] == epic_a["id"]
    assert [label["id"] for label in created_bug["labels"]] == [label_a["id"]]

    update_resp = await client.patch(
        f"/bugs/{created_bug['id']}",
        json={
            "project_id": project_b["id"],
            "epic_id": epic_b["id"],
            "label_ids": [label_b["id"]],
            "title": "Scoped issue",
        },
        headers=owner["headers"],
    )
    assert update_resp.status_code == 200
    updated_bug = update_resp.json()

    assert updated_bug["project_id"] == project_b["id"]
    assert updated_bug["epic_id"] == epic_b["id"]
    assert [label["id"] for label in updated_bug["labels"]] == [label_b["id"]]

    catalog_resp = await client.get(f"/projects/{project_b['id']}/catalog")
    assert catalog_resp.status_code == 200
    catalog = catalog_resp.json()
    assert any(epic["id"] == epic_b["id"] for epic in catalog["epics"])
    assert any(label["id"] == label_b["id"] for label in catalog["labels"])

    project_b_bugs_resp = await client.get(
        f"/projects/{project_b['id']}/bugs?limit=20&offset=0"
    )
    assert project_b_bugs_resp.status_code == 200
    assert [item["id"] for item in project_b_bugs_resp.json()["items"]] == [updated_bug["id"]]
