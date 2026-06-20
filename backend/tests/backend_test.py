"""Backend API tests for Chinese Learning App (Phase 1)."""
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vocab-slots.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def mongo():
    return MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture()
def test_user(mongo):
    """Create a fresh test user + session, cleanup after."""
    user_id = f"TEST_user_{uuid.uuid4().hex[:8]}"
    token = f"TEST_session_{uuid.uuid4().hex}"
    mongo.users.insert_one({
        "user_id": user_id,
        "email": f"TEST_{user_id}@example.com",
        "name": "TEST User",
        "picture": "https://via.placeholder.com/150",
        "nickname": "Tester",
        "created_at": datetime.now(timezone.utc),
    })
    mongo.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    yield {"user_id": user_id, "token": token}
    # Cleanup
    mongo.users.delete_many({"user_id": user_id})
    mongo.user_sessions.delete_many({"user_id": user_id})
    mongo.slots.delete_many({"user_id": user_id})
    mongo.slot_unlocks.delete_many({"user_id": user_id})


@pytest.fixture()
def headers(test_user):
    return {"Authorization": f"Bearer {test_user['token']}", "Content-Type": "application/json"}


# --- Root / Health ---
def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert "message" in r.json()


# --- Auth ---
def test_auth_me_with_token(headers, test_user):
    r = requests.get(f"{API}/auth/me", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user_id"] == test_user["user_id"]
    assert data["nickname"] == "Tester"
    assert "email" in data


def test_auth_me_without_token():
    r = requests.get(f"{API}/auth/me", timeout=15)
    assert r.status_code == 401


# --- Capacity ---
def test_capacity_new_user(headers):
    r = requests.get(f"{API}/slots/capacity", headers=headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d == {"free_slots": 3, "max_slots": 10, "premium_active": [], "total_capacity": 3}


# --- Unlock ---
def test_unlock_slot_4(headers):
    r = requests.post(f"{API}/slots/unlock", headers=headers, json={"slot_index": 4}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["total_capacity"] == 4
    assert any(p["slot_index"] == 4 for p in d["premium_active"])
    exp = datetime.fromisoformat(d["premium_active"][0]["expires_at"])
    delta_days = (exp - datetime.now(timezone.utc)).days
    assert 58 <= delta_days <= 60


def test_unlock_invalid_indices(headers):
    r = requests.post(f"{API}/slots/unlock", headers=headers, json={"slot_index": 3}, timeout=15)
    assert r.status_code == 400
    r = requests.post(f"{API}/slots/unlock", headers=headers, json={"slot_index": 11}, timeout=15)
    assert r.status_code == 400
    r = requests.post(f"{API}/slots/unlock", headers=headers, json={"slot_index": 0}, timeout=15)
    assert r.status_code == 400


# --- Slot CRUD ---
def test_slot_crud(headers):
    # Create
    r = requests.post(f"{API}/slots", headers=headers, json={"name": "HSK1", "kind": "word"}, timeout=15)
    assert r.status_code == 200, r.text
    slot = r.json()
    sid = slot["slot_id"]
    assert slot["name"] == "HSK1"
    assert slot["kind"] == "word"
    assert slot["slot_index"] == 1

    # List
    r = requests.get(f"{API}/slots?kind=word", headers=headers, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert any(s["slot_id"] == sid for s in body["slots"])

    # Patch
    r = requests.patch(f"{API}/slots/{sid}", headers=headers, json={"name": "HSK1-updated"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["name"] == "HSK1-updated"

    # Delete
    r = requests.delete(f"{API}/slots/{sid}", headers=headers, timeout=15)
    assert r.status_code == 200

    # Verify gone
    r = requests.get(f"{API}/slots?kind=word", headers=headers, timeout=15)
    assert not any(s["slot_id"] == sid for s in r.json()["slots"])


def test_slot_create_limit_403(headers):
    for i in range(3):
        r = requests.post(f"{API}/slots", headers=headers, json={"name": f"S{i}", "kind": "word"}, timeout=15)
        assert r.status_code == 200, r.text
    # 4th without unlock
    r = requests.post(f"{API}/slots", headers=headers, json={"name": "S4", "kind": "word"}, timeout=15)
    assert r.status_code == 403
    assert "슬롯" in r.json()["detail"]


# --- Export ---
def test_export_slots(headers):
    requests.post(f"{API}/slots", headers=headers, json={"name": "Exp1", "kind": "word"}, timeout=15)
    r = requests.get(f"{API}/slots/export?kind=word", headers=headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["version"] == 1
    assert d["kind"] == "word"
    assert isinstance(d["slots"], list)
    for s in d["slots"]:
        assert set(s.keys()) == {"name", "items", "bookmarks"}
        assert "user_id" not in s and "slot_id" not in s


# --- Import ---
def test_import_insufficient(headers):
    payload = {
        "kind": "word",
        "slots": [{"name": f"I{i}", "items": [], "bookmarks": []} for i in range(5)],
    }
    r = requests.post(f"{API}/slots/import", headers=headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "insufficient_slots"
    assert d["missing"] == 2
    assert d["available"] == 3
    assert d["incoming_count"] == 5
    assert "슬롯" in d["message"]


def test_import_force(headers):
    payload = {
        "kind": "word",
        "slots": [{"name": f"F{i}", "items": [{"cn": "你好"}], "bookmarks": []} for i in range(5)],
        "force": True,
    }
    r = requests.post(f"{API}/slots/import", headers=headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "ok"
    assert d["imported"] == 3
    assert d["skipped"] == 2


def test_import_sentence_kind(headers):
    payload = {
        "kind": "sentence",
        "slots": [{"name": "Sent1", "items": [{"cn": "你好"}], "bookmarks": []}],
    }
    r = requests.post(f"{API}/slots/import", headers=headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "ok"
    assert d["imported"] == 1


def test_import_invalid_kind(headers):
    payload = {"kind": "bogus", "slots": []}
    r = requests.post(f"{API}/slots/import", headers=headers, json=payload, timeout=15)
    assert r.status_code == 400
