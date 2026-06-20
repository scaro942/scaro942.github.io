# Chinese Learning Slots App — PRD

## Original Problem Statement
중국어 학습 웹 애플리케이션. 기존 단일 HTML(Word/Sentence 학습, 슬롯 시스템, 퀴즈/플래시카드/미니게임, HanziWriter, AI 패널)을 React로 마이그레이션. Google 로그인, 닉네임/학습 통계 저장. 3개 무료 슬롯 + 4~10번 슬롯은 광고 시청으로 60일간 잠금 해제. 데이터 공유 시 보유 슬롯이 부족하면 불러오기 중단 + 부족 개수 안내.

## User Choices
- Google Login: Emergent-managed Google Auth
- Storage: 둘 다 — 로그인 시 클라우드, 비로그인 시 localStorage
- Slot model: 3 free + 7 premium (ad-unlocked, 60일)
- Ad simulation: Real ad SDK (placeholder mock with 5초 카운트다운, AdSense 연동은 별도 작업)
- Phase 1 scope: 골격 + Google 로그인 + 슬롯 내보내기/불러오기 + 슬롯 개수 검증

## User Personas
- 한국인 중국어 학습자 (HSK, 회화)
- 교재별/챕터별로 단어/문장을 정리하고 싶은 학생
- 모바일·데스크톱 양쪽에서 학습

## Architecture
- Frontend: React 19 + Tailwind + shadcn/ui + Phosphor icons + Sonner
- Backend: FastAPI + MongoDB (motor) + Emergent Google Auth
- Auth: httpOnly cookie + Bearer token
- Data layer: Unified `store.js` switches between Backend API (auth) and localStorage (anonymous)

## What's Implemented (Phase 1 — 2026-02)
- Login page with Google OAuth + Anonymous mode
- AuthCallback page with synchronous session_id processing
- Dashboard with Word/Sentence tabs
- 10-slot grid (3 free + 7 premium) with locked/empty/active states
- Premium slot unlock via mock ad modal (5초 카운트다운 → 60일 활성)
- Slot CRUD (create, rename, delete) with backend persistence + local fallback
- Slot editor page with mode bar
- Item input form (Chinese / Pinyin / Korean) + bulk add
- Export to JSON file
- Import from JSON with slot capacity validation
- "Insufficient slots" modal: cancel / force-import-partial / watch ad to unlock
- Expiration countdowns (pulse animation when < 7 days)
- Sonner toast notifications

## What's Implemented (Phase 2 — 2026-02)
- **Quiz mode** (3 sub-modes):
  - 4지선다 (4-choice) with shuffled distractors + auto-advance feedback
  - 조립 (Assemble): drag Chinese characters into order to spell the answer
  - 필기 (Hand): HanziWriter quiz mode — user traces strokes, mistakes counted
- **Flashcards**:
  - Flip animation with CN-first / KR-first order toggle
  - Bookmark per item (per-slot bookmarks)
  - HanziWriter stroke-order animation panel (toggleable)
  - Web Speech API TTS (`zh-CN`) for native pronunciation
  - Prev / next navigation
- **Bookmark Flashcards**: Same component, filtered to bookmarked items only
- **Mini-games (4 types)**:
  - 단어연결 (Word Match): pair Chinese ↔ Korean
  - 빈칸채우기 (Fill): pick correct Chinese for given Korean
  - 문장연결 (Sentence Match): same as word match but for sentences
  - 듣고찾기 (Listen & Find): TTS plays Chinese, user picks the sentence
- **AI Assistant Panel** (Claude Sonnet 4.5 via Emergent LLM key):
  - 예문 생성 (3 examples with pinyin + Korean)
  - 분석 (meaning, grammar, usage notes)
  - 번역 (natural translation with literal/idiomatic notes)
- **Study Stats Dashboard** (modal from header):
  - Current streak (consecutive learning days)
  - Total questions / correct / accuracy %
  - 14-day mini bar chart with intensity + accuracy color
  - Top frequently-studied items with per-item accuracy
- **HanziWriter** loaded via CDN, wrapped in React component
- **a11y fixes**: All Radix Dialogs now have DialogDescription (0 console warnings)

## What's Implemented (Phase 3 — 2026-02)
- **Grammar Cheat Sheet** (`/grammar` page):
  - 20 default HSK1-HSK3 grammar cards (是, 不, 没, 了, 吗, 的, 在, 能, 要, 很, 一下, 比, 因为~所以, 虽然~但是, 把, 被, 就, 才, 过, 着)
  - Search across title/level/formula/explain/examples
  - Level filter chips (HSK1~6, 기타)
  - Custom card CRUD for authenticated users (title + level + formula + explain + multi-line examples)
- **AI Chat Tutor** (modal from header `nav-chat-btn`):
  - Claude Sonnet 4.5 with conversation history persisted to MongoDB
  - Session ID stored in localStorage; survives page reload
  - "새 대화" button to start fresh session
  - 3 starter suggestions for empty chat
  - Anonymous users share `user_id='anon'` bucket with client-side random session IDs
- **Multi-Slot Combined Study** (`/study?kind=...&ids=...`):
  - Dashboard `multi-select-toggle` enables selection mode
  - Click multiple slot cards to add to combined queue (visible checkmark + blue ring)
  - "학습 시작" launches Study page with merged items from all selected slots
  - Study page exposes Quiz / Flashcards / Mini-games / SRS modes
- **SRS (Spaced Repetition System)** with SM-2 simplified:
  - Per-item ef (ease factor), interval, reps tracked
  - Backend: `POST /api/srs/review`, `GET /api/srs/due` (auth)
  - Anonymous: `localStorage cnxue_srs_v1`
  - "복습" mode in SlotEditor and Study page
  - 4-quality button (다시/어려움/좋음/쉬움) after card flip
  - Interval progression: 1d → 3d → round(prev × ef)

## Backlog
### P0
- Capacitor + AdMob mobile app conversion (when user is ready)
- Real AdSense or Adsterra Rewarded for web monetization (replace 5-sec mock)

### P1
- Per-item drill from `/study` SRS queue across all slots (currently per-slot or per-selection)
- Slot sharing via public link
- Daily streak email/push reminders

## Tech Notes
- All backend routes prefixed with `/api`
- MongoDB collections: `users`, `user_sessions`, `slots`, `slot_unlocks`
- Custom `user_id` field used (never expose MongoDB `_id`)
- Datetimes are timezone-aware (UTC), serialized as ISO strings
