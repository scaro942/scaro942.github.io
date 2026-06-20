from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta, date

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

FREE_SLOTS = 3
PREMIUM_SLOTS = 10
AD_SLOT_DURATION_DAYS = 60
SESSION_DURATION_DAYS = 7
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


class UserUpdate(BaseModel):
    nickname: Optional[str] = None


class SlotUnlock(BaseModel):
    slot_index: int


class Slot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    slot_id: str = Field(default_factory=lambda: f"slot_{uuid.uuid4().hex[:10]}")
    user_id: str
    slot_index: int
    name: str
    kind: str
    items: List[Dict[str, Any]] = Field(default_factory=list)
    bookmarks: List[int] = Field(default_factory=list)
    stats: Dict[str, int] = Field(default_factory=lambda: {"total": 0, "correct": 0})
    expires_at: Optional[str] = None
    is_premium: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SlotCreate(BaseModel):
    name: str
    kind: str
    slot_index: Optional[int] = None


class SlotUpdate(BaseModel):
    name: Optional[str] = None
    items: Optional[List[Dict[str, Any]]] = None
    bookmarks: Optional[List[int]] = None
    stats: Optional[Dict[str, int]] = None


class ImportPayload(BaseModel):
    kind: str
    slots: List[Dict[str, Any]]
    force: bool = False


async def get_user_from_request(request: Request) -> Optional[Dict[str, Any]]:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return None
    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        return None
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        return None
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    return user_doc


async def require_user(request: Request) -> Dict[str, Any]:
    user = await get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def _serialize_user(user: Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(user.get("created_at"), datetime):
        user["created_at"] = user["created_at"].isoformat()
    return user


@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=15.0) as ac:
        r = await ac.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()

    email = data.get("email")
    name = data.get("name") or email
    picture = data.get("picture")
    session_token = data.get("session_token")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "nickname": (name or "").split()[0] if name else "",
            "created_at": datetime.now(timezone.utc),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_DURATION_DAYS)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_DURATION_DAYS * 24 * 60 * 60,
    )

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": _serialize_user(user_doc), "session_token": session_token}


@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await require_user(request)
    return _serialize_user(user)


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api_router.patch("/auth/me")
async def update_me(payload: UserUpdate, request: Request):
    user = await require_user(request)
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    new_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return _serialize_user(new_doc)


async def get_user_capacity(user_id: str) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    unlocks = await db.slot_unlocks.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    active_premium = []
    for u in unlocks:
        exp = u.get("expires_at")
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp and exp > now:
            active_premium.append({
                "slot_index": u["slot_index"],
                "expires_at": exp.isoformat(),
            })
    total = FREE_SLOTS + len(active_premium)
    return {
        "free_slots": FREE_SLOTS,
        "max_slots": PREMIUM_SLOTS,
        "premium_active": active_premium,
        "total_capacity": total,
    }


@api_router.get("/slots/capacity")
async def slots_capacity(request: Request):
    user = await require_user(request)
    return await get_user_capacity(user["user_id"])


@api_router.post("/slots/unlock")
async def unlock_slot(payload: SlotUnlock, request: Request):
    user = await require_user(request)
    idx = payload.slot_index
    if idx <= FREE_SLOTS or idx > PREMIUM_SLOTS:
        raise HTTPException(status_code=400, detail="Invalid slot index for unlock")
    expires_at = datetime.now(timezone.utc) + timedelta(days=AD_SLOT_DURATION_DAYS)
    await db.slot_unlocks.update_one(
        {"user_id": user["user_id"], "slot_index": idx},
        {"$set": {
            "user_id": user["user_id"],
            "slot_index": idx,
            "expires_at": expires_at,
            "unlocked_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return await get_user_capacity(user["user_id"])


@api_router.get("/slots")
async def list_slots(request: Request, kind: str = "word"):
    user = await require_user(request)
    docs = await db.slots.find({"user_id": user["user_id"], "kind": kind}, {"_id": 0}).to_list(1000)
    capacity = await get_user_capacity(user["user_id"])
    return {"slots": docs, "capacity": capacity}


def _next_slot_index(existing_indices: List[int], capacity_total: int) -> Optional[int]:
    for i in range(1, capacity_total + 1):
        if i not in existing_indices:
            return i
    return None


@api_router.post("/slots")
async def create_slot(payload: SlotCreate, request: Request):
    user = await require_user(request)
    if payload.kind not in ("word", "sentence"):
        raise HTTPException(status_code=400, detail="invalid kind")
    capacity = await get_user_capacity(user["user_id"])
    existing = await db.slots.find(
        {"user_id": user["user_id"], "kind": payload.kind}, {"_id": 0, "slot_index": 1}
    ).to_list(1000)
    used = [s["slot_index"] for s in existing]

    if payload.slot_index is not None:
        if payload.slot_index in used:
            raise HTTPException(status_code=400, detail="slot_index in use")
        idx = payload.slot_index
    else:
        idx = _next_slot_index(used, capacity["total_capacity"])
        if idx is None:
            raise HTTPException(
                status_code=403,
                detail=f"슬롯 부족: 현재 {capacity['total_capacity']}개 사용 가능. 슬롯을 해제하세요.",
            )

    is_premium = idx > FREE_SLOTS
    exp = None
    if is_premium:
        match = next((p for p in capacity["premium_active"] if p["slot_index"] == idx), None)
        if not match:
            raise HTTPException(status_code=403, detail="해당 슬롯은 잠겨있습니다. 광고를 시청해 해제하세요.")
        exp = match["expires_at"]

    slot = Slot(
        user_id=user["user_id"],
        slot_index=idx,
        name=payload.name,
        kind=payload.kind,
        is_premium=is_premium,
        expires_at=exp,
    )
    await db.slots.insert_one(slot.model_dump())
    return slot.model_dump()


@api_router.patch("/slots/{slot_id}")
async def update_slot(slot_id: str, payload: SlotUpdate, request: Request):
    user = await require_user(request)
    existing = await db.slots.find_one({"slot_id": slot_id, "user_id": user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="slot not found")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.slots.update_one({"slot_id": slot_id}, {"$set": updates})
    new_doc = await db.slots.find_one({"slot_id": slot_id}, {"_id": 0})
    return new_doc


@api_router.delete("/slots/{slot_id}")
async def delete_slot(slot_id: str, request: Request):
    user = await require_user(request)
    res = await db.slots.delete_one({"slot_id": slot_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="slot not found")
    return {"ok": True}


@api_router.get("/slots/export")
async def export_slots(request: Request, kind: str = "word"):
    user = await require_user(request)
    docs = await db.slots.find({"user_id": user["user_id"], "kind": kind}, {"_id": 0}).to_list(1000)
    return {
        "version": 1,
        "kind": kind,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "slots": [
            {"name": d["name"], "items": d.get("items", []), "bookmarks": d.get("bookmarks", [])}
            for d in docs
        ],
    }


@api_router.post("/slots/import")
async def import_slots(payload: ImportPayload, request: Request):
    user = await require_user(request)
    if payload.kind not in ("word", "sentence"):
        raise HTTPException(status_code=400, detail="invalid kind")

    capacity = await get_user_capacity(user["user_id"])
    existing = await db.slots.find(
        {"user_id": user["user_id"], "kind": payload.kind}, {"_id": 0, "slot_index": 1}
    ).to_list(1000)
    used = [s["slot_index"] for s in existing]
    free_indices = [i for i in range(1, capacity["total_capacity"] + 1) if i not in used]

    incoming_count = len(payload.slots)
    available = len(free_indices)

    if incoming_count > available and not payload.force:
        return {
            "status": "insufficient_slots",
            "incoming_count": incoming_count,
            "available": available,
            "missing": incoming_count - available,
            "total_capacity": capacity["total_capacity"],
            "used": len(used),
            "free_slots": FREE_SLOTS,
            "premium_active": capacity["premium_active"],
            "message": f"슬롯이 부족합니다. {incoming_count - available}개 슬롯을 추가로 확보해야 합니다.",
        }

    to_import = min(incoming_count, available)
    imported = []
    for i in range(to_import):
        idx = free_indices[i]
        is_premium = idx > FREE_SLOTS
        exp = None
        if is_premium:
            match = next((p for p in capacity["premium_active"] if p["slot_index"] == idx), None)
            if match:
                exp = match["expires_at"]
        s = payload.slots[i]
        slot = Slot(
            user_id=user["user_id"],
            slot_index=idx,
            name=s.get("name", f"Slot {idx}"),
            kind=payload.kind,
            items=s.get("items", []),
            bookmarks=s.get("bookmarks", []),
            is_premium=is_premium,
            expires_at=exp,
        )
        await db.slots.insert_one(slot.model_dump())
        imported.append(slot.model_dump())

    return {
        "status": "ok",
        "imported": len(imported),
        "skipped": incoming_count - len(imported),
        "slots": imported,
    }


@api_router.get("/")
async def root():
    return {"message": "Chinese Learning API"}


# ===================== Progress Tracking =====================
class ProgressRecord(BaseModel):
    kind: str
    label: str
    correct: bool
    mode: Optional[str] = None


@api_router.post("/progress/record")
async def record_progress(payload: ProgressRecord, request: Request):
    user = await require_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.progress_days.update_one(
        {"user_id": user["user_id"], "date": today},
        {"$inc": {"total": 1, "correct": 1 if payload.correct else 0}},
        upsert=True,
    )
    item_key = f"{payload.kind}::{payload.label}"
    await db.progress_items.update_one(
        {"user_id": user["user_id"], "key": item_key},
        {"$inc": {"total": 1, "correct": 1 if payload.correct else 0},
         "$set": {"kind": payload.kind, "label": payload.label,
                  "last_seen": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/progress")
async def get_progress(request: Request):
    user = await require_user(request)
    days = await db.progress_days.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("date", -1).to_list(60)
    items = await db.progress_items.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("total", -1).to_list(200)

    today = datetime.now(timezone.utc).date()
    day_set = {d["date"] for d in days if d.get("total", 0) > 0}
    streak = 0
    cur = today
    while cur.strftime("%Y-%m-%d") in day_set:
        streak += 1
        cur = cur - timedelta(days=1)

    total = sum(d.get("total", 0) for d in days)
    correct = sum(d.get("correct", 0) for d in days)
    accuracy = round(correct / total * 100) if total else 0
    return {"days": days, "items": items, "streak": streak,
            "total": total, "correct": correct, "accuracy": accuracy}


# ===================== AI Assistant (Claude Sonnet 4.5) =====================
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

AI_SYSTEM_PROMPT = (
    "당신은 한국인 중국어 학습자를 돕는 친절한 중국어 선생님입니다. "
    "답변은 항상 한국어로 명확하고 간결하게 해주세요. "
    "중국어 예문에는 반드시 병음(Pinyin)과 한국어 번역을 함께 제공합니다. "
    "마크다운은 사용하지 말고 줄바꿈으로 구분된 일반 텍스트로 답하세요."
)


class AIQuery(BaseModel):
    type: str
    chinese: Optional[str] = ""
    pinyin: Optional[str] = ""
    korean: Optional[str] = ""
    kind: str = "word"


async def call_claude(prompt: str) -> str:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"cnxue-{uuid.uuid4().hex[:8]}",
        system_message=AI_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    out = []
    try:
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                out.append(ev.content)
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        logger.exception("LLM call failed")
        raise HTTPException(status_code=502, detail=f"AI 호출 실패: {e}")
    return "".join(out).strip()


@api_router.post("/ai/query")
async def ai_query(payload: AIQuery, request: Request):
    _ = await get_user_from_request(request)
    target = (payload.chinese or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="chinese 텍스트가 필요합니다")

    if payload.type == "example":
        prompt = (
            f"다음 중국어 {'단어' if payload.kind == 'word' else '문장'} "
            f"'{target}'을(를) 사용한 자연스러운 예문 3개를 만들어주세요. "
            "각 예문마다 다음 형식으로:\n\n"
            "예문 1: [중국어]\n병음: [pinyin]\n한국어: [번역]\n\n"
            "예문 사이는 빈 줄로 구분해주세요."
        )
    elif payload.type == "analyze":
        prompt = (
            f"중국어 {'단어' if payload.kind == 'word' else '문장'} '{target}'을(를) "
            "분석해주세요. 다음을 포함해주세요:\n"
            "1. 의미와 뉘앙스\n2. 문법 구조 (해당되는 경우)\n"
            "3. 사용 시 주의사항\n4. 비슷한 표현이나 동의어 1-2개"
        )
    elif payload.type == "translate":
        prompt = (
            f"중국어 '{target}'을(를) 한국어로 자연스럽게 번역하고, "
            "직역과 의역의 차이가 있다면 함께 설명해주세요. "
            f"병음 '{payload.pinyin or '제공되지 않음'}'도 참고해주세요."
        )
    else:
        raise HTTPException(status_code=400, detail="알 수 없는 type")

    result = await call_claude(prompt)
    return {"result": result}


# ===================== AI Chat Tutor (with history) =====================
CHAT_SYSTEM = (
    "당신은 한국인 학습자를 가르치는 친절하고 인내심 많은 중국어 선생님입니다. "
    "학습자의 수준에 맞춰 한국어로 설명하되, 중국어 예문에는 반드시 병음(Pinyin)을 함께 제공하세요. "
    "마크다운은 사용하지 말고 자연스러운 대화체로 답변하세요. "
    "답변은 가능한 한 간결하게 (2-4 문단 이내), 학습자에게 다음 질문을 유도하도록 마무리하세요."
)


class ChatMessageIn(BaseModel):
    message: str
    session_id: Optional[str] = None  # null on first message


@api_router.post("/ai/chat")
async def ai_chat(payload: ChatMessageIn, request: Request):
    user = await get_user_from_request(request)
    user_id = user["user_id"] if user else "anon"
    sid = payload.session_id or f"chat_{uuid.uuid4().hex[:12]}"

    # Load history for this user+session
    msgs = await db.chat_messages.find(
        {"user_id": user_id, "session_id": sid}, {"_id": 0}
    ).sort("created_at", 1).to_list(80)

    # Build history into the system message (since LlmChat doesn't accept role history)
    history_text = ""
    if msgs:
        history_text = "\n\n[이전 대화 요약]\n"
        for m in msgs[-12:]:  # last 12 turns
            role = "학생" if m["role"] == "user" else "선생님"
            history_text += f"{role}: {m['content']}\n"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=sid,
        system_message=CHAT_SYSTEM + history_text,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    out = []
    try:
        async for ev in chat.stream_message(UserMessage(text=payload.message)):
            if isinstance(ev, TextDelta):
                out.append(ev.content)
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        logger.exception("Chat failed")
        raise HTTPException(status_code=502, detail=f"AI 호출 실패: {e}")
    reply = "".join(out).strip()

    now = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_many([
        {"user_id": user_id, "session_id": sid, "role": "user",
         "content": payload.message, "created_at": now},
        {"user_id": user_id, "session_id": sid, "role": "assistant",
         "content": reply, "created_at": now},
    ])
    return {"session_id": sid, "reply": reply}


@api_router.get("/ai/chat/{session_id}")
async def chat_history(session_id: str, request: Request):
    user = await get_user_from_request(request)
    user_id = user["user_id"] if user else "anon"
    msgs = await db.chat_messages.find(
        {"user_id": user_id, "session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return {"session_id": session_id, "messages": msgs}


@api_router.get("/ai/chat-sessions")
async def chat_sessions(request: Request):
    user = await get_user_from_request(request)
    user_id = user["user_id"] if user else "anon"
    # Aggregate sessions by session_id
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$session_id",
            "last_message": {"$first": "$content"},
            "last_at": {"$first": "$created_at"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"last_at": -1}},
        {"$limit": 20},
    ]
    docs = await db.chat_messages.aggregate(pipeline).to_list(20)
    return [
        {"session_id": d["_id"], "preview": d["last_message"][:80],
         "last_at": d["last_at"], "count": d["count"]}
        for d in docs
    ]


# ===================== Grammar Cheat Sheet =====================
DEFAULT_GRAMMAR = [
    {"id": "g_be", "level": "HSK1", "title": "是 (~이다)",
     "formula": "주어 + 是 + 명사", "explain": "A는 B이다. 가장 기본적인 'A=B' 문형.",
     "examples": ["我是学生。 (wǒ shì xuéshēng) — 나는 학생이다."]},
    {"id": "g_neg_bu", "level": "HSK1", "title": "不 (부정)",
     "formula": "不 + 동사/형용사", "explain": "현재·미래 부정. 4성 앞에서는 2성으로 변조.",
     "examples": ["我不喝咖啡。 (wǒ bù hē kāfēi) — 나는 커피를 마시지 않는다."]},
    {"id": "g_neg_mei", "level": "HSK1", "title": "没/没有 (과거 부정)",
     "formula": "没 + 동사", "explain": "과거 사실의 부정. '아직 ~하지 않았다'.",
     "examples": ["我没吃饭。 (wǒ méi chī fàn) — 나는 밥을 안 먹었다."]},
    {"id": "g_le", "level": "HSK2", "title": "了 (완료/변화)",
     "formula": "동사 + 了", "explain": "완료 또는 새로운 상황.",
     "examples": ["他来了。 (tā lái le) — 그가 왔다."]},
    {"id": "g_ma", "level": "HSK1", "title": "吗 (의문)",
     "formula": "평서문 + 吗?", "explain": "예/아니오 질문.",
     "examples": ["你好吗? (nǐ hǎo ma) — 잘 지내?"]},
    {"id": "g_de_attr", "level": "HSK1", "title": "的 (수식)",
     "formula": "A + 的 + B", "explain": "A가 B를 수식. (소유/속성).",
     "examples": ["我的书 (wǒ de shū) — 나의 책"]},
    {"id": "g_zai", "level": "HSK2", "title": "在 (진행/장소)",
     "formula": "在 + 장소 / 在 + 동사", "explain": "장소: ~에서. 진행: ~하는 중.",
     "examples": ["我在家。 (wǒ zài jiā) — 나는 집에 있다.",
                  "我在吃饭。 (wǒ zài chī fàn) — 나는 밥을 먹고 있다."]},
    {"id": "g_neng", "level": "HSK2", "title": "能/可以 (가능)",
     "formula": "能/可以 + 동사", "explain": "能: 능력·가능성. 可以: 허가.",
     "examples": ["我能游泳。 (wǒ néng yóuyǒng) — 나는 수영할 수 있다."]},
    {"id": "g_yao", "level": "HSK2", "title": "要 (의지/미래)",
     "formula": "要 + 동사", "explain": "~하려고 한다 / ~할 것이다.",
     "examples": ["我要去中国。 (wǒ yào qù Zhōngguó) — 나는 중국에 갈 거야."]},
    {"id": "g_hen", "level": "HSK1", "title": "很 (정도)",
     "formula": "很 + 형용사", "explain": "형용사 앞에 '매우'. 단독 형용사 술어와 함께 쓰임.",
     "examples": ["天气很好。 (tiānqì hěn hǎo) — 날씨가 좋다."]},
    {"id": "g_yi_xia", "level": "HSK2", "title": "一下 (가볍게 ~하다)",
     "formula": "동사 + 一下", "explain": "잠깐 / 가볍게 한번.",
     "examples": ["看一下。 (kàn yī xià) — 한번 봐."]},
    {"id": "g_bi", "level": "HSK3", "title": "比 (비교)",
     "formula": "A + 比 + B + 형용사", "explain": "A가 B보다 ~하다.",
     "examples": ["他比我高。 (tā bǐ wǒ gāo) — 그가 나보다 크다."]},
    {"id": "g_yinwei", "level": "HSK3", "title": "因为~所以 (인과)",
     "formula": "因为 + 원인, 所以 + 결과", "explain": "~때문에, 그래서 ~하다.",
     "examples": ["因为下雨,所以我没去。 (yīnwèi xiàyǔ, suǒyǐ wǒ méi qù) — 비가 와서 못 갔다."]},
    {"id": "g_suiran", "level": "HSK3", "title": "虽然~但是 (역접)",
     "formula": "虽然 A, 但是 B", "explain": "비록 A이지만 B이다.",
     "examples": ["虽然累,但是开心。 (suīrán lèi, dànshì kāixīn) — 피곤하지만 즐겁다."]},
    {"id": "g_ba", "level": "HSK3", "title": "把 (처치문)",
     "formula": "주어 + 把 + 목적어 + 동사+기타성분", "explain": "특정 대상을 어떻게 처리했는지 강조.",
     "examples": ["我把书放在桌子上。 (wǒ bǎ shū fàng zài zhuōzi shàng) — 나는 책을 책상 위에 놓았다."]},
    {"id": "g_bei", "level": "HSK3", "title": "被 (피동)",
     "formula": "주어 + 被 + 행위자 + 동사", "explain": "~에 의해 ~당하다.",
     "examples": ["蛋糕被吃了。 (dàngāo bèi chī le) — 케이크가 (누군가에 의해) 먹혔다."]},
    {"id": "g_jiu", "level": "HSK3", "title": "就 (즉시/바로)",
     "formula": "주어 + 就 + 동사", "explain": "곧장 / 바로. 시간·조건의 즉시성 강조.",
     "examples": ["我马上就来。 (wǒ mǎshàng jiù lái) — 곧 갈게."]},
    {"id": "g_cai", "level": "HSK3", "title": "才 (비로소)",
     "formula": "주어 + 才 + 동사", "explain": "예상보다 늦거나 어렵게 ~하다.",
     "examples": ["他十点才来。 (tā shí diǎn cái lái) — 그는 10시에 와서야 왔다."]},
    {"id": "g_guo", "level": "HSK2", "title": "过 (경험)",
     "formula": "동사 + 过", "explain": "~해 본 적이 있다.",
     "examples": ["我去过北京。 (wǒ qù guo Běijīng) — 나는 베이징에 가 본 적이 있다."]},
    {"id": "g_zhe", "level": "HSK3", "title": "着 (상태 지속)",
     "formula": "동사 + 着", "explain": "동작·상태가 지속되는 중.",
     "examples": ["门开着。 (mén kāi zhe) — 문이 열려 있다."]},
]


class GrammarCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: f"gc_{uuid.uuid4().hex[:10]}")
    user_id: Optional[str] = None  # None for defaults
    level: Optional[str] = ""
    title: str
    formula: Optional[str] = ""
    explain: Optional[str] = ""
    examples: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class GrammarIn(BaseModel):
    title: str
    level: Optional[str] = ""
    formula: Optional[str] = ""
    explain: Optional[str] = ""
    examples: List[str] = Field(default_factory=list)


@api_router.get("/grammar")
async def list_grammar(request: Request):
    user = await get_user_from_request(request)
    custom = []
    if user:
        custom = await db.grammar_cards.find(
            {"user_id": user["user_id"]}, {"_id": 0}
        ).sort("created_at", -1).to_list(500)
    return {"defaults": DEFAULT_GRAMMAR, "custom": custom}


@api_router.post("/grammar")
async def create_grammar(payload: GrammarIn, request: Request):
    user = await require_user(request)
    card = GrammarCard(user_id=user["user_id"], **payload.model_dump())
    await db.grammar_cards.insert_one(card.model_dump())
    return card.model_dump()


@api_router.delete("/grammar/{card_id}")
async def delete_grammar(card_id: str, request: Request):
    user = await require_user(request)
    res = await db.grammar_cards.delete_one(
        {"id": card_id, "user_id": user["user_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


# ===================== SRS (SM-2 simplified) =====================
class SRSReview(BaseModel):
    kind: str  # word | sentence
    label: str  # the chinese text
    quality: int  # 0..5 (0=fail, 5=perfect)


def srs_next(prev: Dict[str, Any], quality: int) -> Dict[str, Any]:
    """Simplified SM-2. Returns updated SRS state for an item."""
    ef = prev.get("ef", 2.5)
    interval = prev.get("interval", 0)
    reps = prev.get("reps", 0)

    if quality < 3:
        reps = 0
        interval = 1
    else:
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 3
        else:
            interval = round(interval * ef)
        reps += 1
        ef = max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

    due = (datetime.now(timezone.utc) + timedelta(days=interval)).isoformat()
    return {"ef": round(ef, 2), "interval": interval, "reps": reps, "due_at": due}


@api_router.post("/srs/review")
async def srs_review(payload: SRSReview, request: Request):
    user = await require_user(request)
    key = f"{payload.kind}::{payload.label}"
    existing = await db.srs_items.find_one(
        {"user_id": user["user_id"], "key": key}, {"_id": 0}
    ) or {}
    nxt = srs_next(existing, payload.quality)
    nxt.update({
        "user_id": user["user_id"],
        "key": key,
        "kind": payload.kind,
        "label": payload.label,
        "last_review": datetime.now(timezone.utc).isoformat(),
    })
    await db.srs_items.update_one(
        {"user_id": user["user_id"], "key": key},
        {"$set": nxt}, upsert=True,
    )
    return nxt


@api_router.get("/srs/due")
async def srs_due(request: Request, kind: str = "word"):
    user = await require_user(request)
    now_iso = datetime.now(timezone.utc).isoformat()
    items = await db.srs_items.find(
        {"user_id": user["user_id"], "kind": kind,
         "due_at": {"$lte": now_iso}}, {"_id": 0}
    ).sort("due_at", 1).to_list(500)
    return {"due": items, "count": len(items)}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
