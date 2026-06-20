"""Phase 2: AI Assistant + Progress Tracking backend tests."""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vocab-slots.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def mongo():
    return MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture()
def test_user(mongo):
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
    mongo.users.delete_many({"user_id": user_id})
    mongo.user_sessions.delete_many({"user_id": user_id})
    mongo.progress_days.delete_many({"user_id": user_id})
    mongo.progress_items.delete_many({"user_id": user_id})


@pytest.fixture()
def headers(test_user):
    return {"Authorization": f"Bearer {test_user['token']}", "Content-Type": "application/json"}


# ============ AI /api/ai/query ============
def test_ai_translate_word():
    r = requests.post(f"{API}/ai/query",
                      json={"type": "translate", "chinese": "你好", "kind": "word"},
                      timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "result" in d
    assert isinstance(d["result"], str)
    assert len(d["result"]) > 0


def test_ai_example_word():
    r = requests.post(f"{API}/ai/query",
                      json={"type": "example", "chinese": "你好", "kind": "word"},
                      timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d["result"], str) and len(d["result"]) > 0


def test_ai_analyze_word():
    r = requests.post(f"{API}/ai/query",
                      json={"type": "analyze", "chinese": "你好", "kind": "word"},
                      timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d["result"], str) and len(d["result"]) > 0


def test_ai_invalid_type():
    r = requests.post(f"{API}/ai/query",
                      json={"type": "invalid", "chinese": "你好", "kind": "word"},
                      timeout=30)
    assert r.status_code == 400


def test_ai_missing_chinese():
    r = requests.post(f"{API}/ai/query",
                      json={"type": "translate", "kind": "word"},
                      timeout=30)
    assert r.status_code == 400


def test_ai_empty_chinese():
    r = requests.post(f"{API}/ai/query",
                      json={"type": "translate", "chinese": "   ", "kind": "word"},
                      timeout=30)
    assert r.status_code == 400


# ============ Progress endpoints ============
def test_progress_record_requires_auth():
    r = requests.post(f"{API}/progress/record",
                      json={"kind": "word", "label": "你好", "correct": True, "mode": "quiz"},
                      timeout=15)
    assert r.status_code == 401


def test_progress_get_requires_auth():
    r = requests.get(f"{API}/progress", timeout=15)
    assert r.status_code == 401


def test_progress_record_and_get(headers, test_user, mongo):
    # 2 correct + 1 wrong
    for label, ok in [("你好", True), ("再见", True), ("谢谢", False)]:
        r = requests.post(f"{API}/progress/record", headers=headers,
                          json={"kind": "word", "label": label, "correct": ok, "mode": "quiz"},
                          timeout=15)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}

    r = requests.get(f"{API}/progress", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["total"] == 3
    assert d["correct"] == 2
    assert d["accuracy"] == 67
    assert d["streak"] >= 1
    assert isinstance(d["days"], list) and len(d["days"]) >= 1
    assert isinstance(d["items"], list)
    labels = {it["label"] for it in d["items"]}
    assert {"你好", "再见", "谢谢"}.issubset(labels)


def test_progress_same_day_accumulates(headers, test_user):
    for i in range(3):
        requests.post(f"{API}/progress/record", headers=headers,
                      json={"kind": "word", "label": f"w{i}", "correct": True, "mode": "quiz"},
                      timeout=15)
    r = requests.get(f"{API}/progress", headers=headers, timeout=15)
    d = r.json()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    todays = [day for day in d["days"] if day["date"] == today]
    assert len(todays) == 1, f"Expected single day entry, got {len(todays)}"
    assert todays[0]["total"] == 3
    assert todays[0]["correct"] == 3


def test_progress_item_accumulate(headers):
    for _ in range(3):
        requests.post(f"{API}/progress/record", headers=headers,
                      json={"kind": "word", "label": "测试", "correct": True, "mode": "quiz"},
                      timeout=15)
    r = requests.get(f"{API}/progress", headers=headers, timeout=15)
    d = r.json()
    test_item = next((it for it in d["items"] if it["label"] == "测试"), None)
    assert test_item is not None
    assert test_item["total"] == 3
    assert test_item["correct"] == 3
