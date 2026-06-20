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
from datetime import datetime, timezone, timedelta

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
