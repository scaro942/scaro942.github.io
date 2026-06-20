"""Phase 3: Grammar, AI Chat Tutor (history), SRS (SM-2) backend tests."""
import os
import uuid
import time
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
    mongo.grammar_cards.delete_many({"user_id": user_id})
    mongo.srs_items.delete_many({"user_id": user_id})
    mongo.chat_messages.delete_many({"user_id": user_id})


@pytest.fixture()
def headers(test_user):
    return {"Authorization": f"Bearer {test_user['token']}", "Content-Type": "application/json"}


# ============ Grammar ============
def test_grammar_defaults_anonymous():
    r = requests.get(f"{API}/grammar", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "defaults" in d and "custom" in d
    assert isinstance(d["defaults"], list)
    assert len(d["defaults"]) == 20
    assert d["custom"] == []
    # Check fields on first default
    first = d["defaults"][0]
    for k in ("id", "title", "level", "formula", "explain", "examples"):
        assert k in first, f"missing {k}"
    assert isinstance(first["examples"], list)


def test_grammar_create_requires_auth():
    r = requests.post(f"{API}/grammar",
                      json={"title": "test", "level": "HSK1"}, timeout=15)
    assert r.status_code == 401


def test_grammar_delete_requires_auth():
    r = requests.delete(f"{API}/grammar/some-id", timeout=15)
    assert r.status_code == 401


def test_grammar_create_get_delete(headers):
    payload = {
        "title": "TEST_카드",
        "level": "HSK4",
        "formula": "X+Y",
        "explain": "설명",
        "examples": ["예문1"],
    }
    r = requests.post(f"{API}/grammar", headers=headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    card = r.json()
    assert card["title"] == "TEST_카드"
    assert card["level"] == "HSK4"
    assert card["formula"] == "X+Y"
    assert card["explain"] == "설명"
    assert card["examples"] == ["예문1"]
    assert "id" in card
    cid = card["id"]

    # GET shows it under custom
    r2 = requests.get(f"{API}/grammar", headers=headers, timeout=15)
    assert r2.status_code == 200
    d = r2.json()
    assert any(c["id"] == cid for c in d["custom"]), "created card not in custom list"
    assert len(d["defaults"]) == 20

    # DELETE
    r3 = requests.delete(f"{API}/grammar/{cid}", headers=headers, timeout=15)
    assert r3.status_code == 200
    assert r3.json() == {"ok": True}

    # Verify removed
    r4 = requests.get(f"{API}/grammar", headers=headers, timeout=15)
    assert not any(c["id"] == cid for c in r4.json()["custom"])

    # Delete again -> 404
    r5 = requests.delete(f"{API}/grammar/{cid}", headers=headers, timeout=15)
    assert r5.status_code == 404


# ============ AI Chat Tutor ============
def test_chat_anonymous_session_created(mongo):
    sid_key = f"TEST_anon_{uuid.uuid4().hex[:8]}"
    # First message - no session_id (generated server side)
    r = requests.post(f"{API}/ai/chat",
                      json={"message": "안녕하세요"}, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "session_id" in d and d["session_id"].startswith("chat_")
    assert "reply" in d and isinstance(d["reply"], str) and len(d["reply"]) > 0
    sid = d["session_id"]

    # Cleanup
    mongo.chat_messages.delete_many({"session_id": sid})


def test_chat_session_continues_and_history(mongo, headers, test_user):
    # First message
    r1 = requests.post(f"{API}/ai/chat", headers=headers,
                       json={"message": "你好는 무슨 뜻인가요?"}, timeout=90)
    assert r1.status_code == 200, r1.text
    d1 = r1.json()
    sid = d1["session_id"]
    assert sid.startswith("chat_")
    assert len(d1["reply"]) > 0

    # Second message - same session
    r2 = requests.post(f"{API}/ai/chat", headers=headers,
                       json={"message": "그럼 再见은?", "session_id": sid}, timeout=90)
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2["session_id"] == sid
    assert len(d2["reply"]) > 0

    # History
    r3 = requests.get(f"{API}/ai/chat/{sid}", headers=headers, timeout=15)
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["session_id"] == sid
    assert "messages" in d3
    assert len(d3["messages"]) == 4
    roles = [m["role"] for m in d3["messages"]]
    assert roles == ["user", "assistant", "user", "assistant"]

    # Aggregated sessions
    r4 = requests.get(f"{API}/ai/chat-sessions", headers=headers, timeout=15)
    assert r4.status_code == 200
    sessions = r4.json()
    assert isinstance(sessions, list)
    assert any(s["session_id"] == sid for s in sessions)


# ============ SRS ============
def test_srs_review_requires_auth():
    r = requests.post(f"{API}/srs/review",
                      json={"kind": "word", "label": "你好", "quality": 5}, timeout=15)
    assert r.status_code == 401


def test_srs_due_requires_auth():
    r = requests.get(f"{API}/srs/due", timeout=15)
    assert r.status_code == 401


def test_srs_sm2_progression(headers):
    label = f"TEST_{uuid.uuid4().hex[:6]}"
    # First review quality=5
    r = requests.post(f"{API}/srs/review", headers=headers,
                      json={"kind": "word", "label": label, "quality": 5}, timeout=15)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["reps"] == 1
    assert s["interval"] == 1
    assert isinstance(s["ef"], (int, float))
    assert "due_at" in s
    # Parse ISO date
    due = datetime.fromisoformat(s["due_at"])
    assert due > datetime.now(timezone.utc)

    # Second review quality=5
    r2 = requests.post(f"{API}/srs/review", headers=headers,
                      json={"kind": "word", "label": label, "quality": 5}, timeout=15)
    s2 = r2.json()
    assert s2["reps"] == 2
    assert s2["interval"] == 3


def test_srs_quality_zero_resets(headers):
    label = f"TEST_{uuid.uuid4().hex[:6]}"
    # warm-up to reps>0
    requests.post(f"{API}/srs/review", headers=headers,
                  json={"kind": "word", "label": label, "quality": 5}, timeout=15)
    requests.post(f"{API}/srs/review", headers=headers,
                  json={"kind": "word", "label": label, "quality": 5}, timeout=15)
    # Now fail
    r = requests.post(f"{API}/srs/review", headers=headers,
                      json={"kind": "word", "label": label, "quality": 0}, timeout=15)
    s = r.json()
    assert s["reps"] == 0
    assert s["interval"] == 1


def test_srs_due_excludes_future(headers):
    label = f"TEST_{uuid.uuid4().hex[:6]}"
    # Review with q=5 sets due_at to 1 day in future
    requests.post(f"{API}/srs/review", headers=headers,
                  json={"kind": "word", "label": label, "quality": 5}, timeout=15)
    r = requests.get(f"{API}/srs/due?kind=word", headers=headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    labels = [it["label"] for it in d.get("due", [])]
    assert label not in labels, "item with future due_at should not appear"
