// Lightweight local-only slot store for anonymous mode (mirrors backend API).
const KEY = "cnxue_local_v1";

const FREE_SLOTS = 3;
const PREMIUM_SLOTS = 10;
const AD_DAYS = 60;

function readStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return { unlocks: [], slots: { word: [], sentence: [] } };
}
function writeStore(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function nowMs() { return Date.now(); }

export function localCapacity() {
  const s = readStore();
  const active = s.unlocks.filter((u) => u.expires_at > nowMs());
  return {
    free_slots: FREE_SLOTS,
    max_slots: PREMIUM_SLOTS,
    premium_active: active.map((u) => ({
      slot_index: u.slot_index,
      expires_at: new Date(u.expires_at).toISOString(),
    })),
    total_capacity: FREE_SLOTS + active.length,
  };
}

export function localList(kind) {
  const s = readStore();
  return { slots: s.slots[kind] || [], capacity: localCapacity() };
}

export function localUnlock(slot_index) {
  const s = readStore();
  if (slot_index <= FREE_SLOTS || slot_index > PREMIUM_SLOTS) throw new Error("invalid index");
  const expires_at = nowMs() + AD_DAYS * 24 * 60 * 60 * 1000;
  const existing = s.unlocks.find((u) => u.slot_index === slot_index);
  if (existing) existing.expires_at = expires_at;
  else s.unlocks.push({ slot_index, expires_at });
  writeStore(s);
  return localCapacity();
}

function nextIndex(used, total) {
  for (let i = 1; i <= total; i++) if (!used.includes(i)) return i;
  return null;
}

export function localCreate({ kind, name, slot_index }) {
  const s = readStore();
  const cap = localCapacity();
  const list = s.slots[kind] || [];
  const used = list.map((x) => x.slot_index);
  let idx = slot_index;
  if (!idx) idx = nextIndex(used, cap.total_capacity);
  if (!idx) throw new Error("슬롯 부족");
  if (used.includes(idx)) throw new Error("이미 사용 중인 슬롯");
  const is_premium = idx > FREE_SLOTS;
  let expires_at = null;
  if (is_premium) {
    const m = cap.premium_active.find((p) => p.slot_index === idx);
    if (!m) throw new Error("잠긴 슬롯입니다.");
    expires_at = m.expires_at;
  }
  const slot = {
    slot_id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    slot_index: idx,
    name,
    kind,
    items: [],
    bookmarks: [],
    stats: { total: 0, correct: 0 },
    expires_at,
    is_premium,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  list.push(slot);
  s.slots[kind] = list;
  writeStore(s);
  return slot;
}

export function localUpdate(kind, slot_id, patch) {
  const s = readStore();
  const list = s.slots[kind] || [];
  const i = list.findIndex((x) => x.slot_id === slot_id);
  if (i < 0) throw new Error("not found");
  list[i] = { ...list[i], ...patch, updated_at: new Date().toISOString() };
  writeStore(s);
  return list[i];
}

export function localDelete(kind, slot_id) {
  const s = readStore();
  s.slots[kind] = (s.slots[kind] || []).filter((x) => x.slot_id !== slot_id);
  writeStore(s);
}

export function localExport(kind) {
  const s = readStore();
  const docs = s.slots[kind] || [];
  return {
    version: 1,
    kind,
    exported_at: new Date().toISOString(),
    slots: docs.map((d) => ({ name: d.name, items: d.items, bookmarks: d.bookmarks })),
  };
}

export function localImport({ kind, slots, force = false }) {
  const s = readStore();
  const cap = localCapacity();
  const list = s.slots[kind] || [];
  const used = list.map((x) => x.slot_index);
  const free = [];
  for (let i = 1; i <= cap.total_capacity; i++) if (!used.includes(i)) free.push(i);
  const incoming = slots.length;
  const available = free.length;
  if (incoming > available && !force) {
    return {
      status: "insufficient_slots",
      incoming_count: incoming,
      available,
      missing: incoming - available,
      total_capacity: cap.total_capacity,
      used: used.length,
      free_slots: FREE_SLOTS,
      premium_active: cap.premium_active,
      message: `슬롯이 부족합니다. ${incoming - available}개 슬롯을 추가로 확보해야 합니다.`,
    };
  }
  const to = Math.min(incoming, available);
  const imported = [];
  for (let i = 0; i < to; i++) {
    const idx = free[i];
    const is_premium = idx > FREE_SLOTS;
    let expires_at = null;
    if (is_premium) {
      const m = cap.premium_active.find((p) => p.slot_index === idx);
      if (m) expires_at = m.expires_at;
    }
    const slot = {
      slot_id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${idx}`,
      slot_index: idx,
      name: slots[i].name || `Slot ${idx}`,
      kind,
      items: slots[i].items || [],
      bookmarks: slots[i].bookmarks || [],
      stats: { total: 0, correct: 0 },
      expires_at,
      is_premium,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.push(slot);
    imported.push(slot);
  }
  s.slots[kind] = list;
  writeStore(s);
  return { status: "ok", imported: imported.length, skipped: incoming - imported.length, slots: imported };
}
