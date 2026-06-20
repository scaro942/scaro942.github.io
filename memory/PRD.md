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
- Slot editor page with mode bar (Input ready, Quiz/Flash/Bookmark/Game = soon)
- Item input form (Chinese / Pinyin / Korean) + bulk add
- Export to JSON file
- Import from JSON with slot capacity validation
- "Insufficient slots" modal: cancel / force-import-partial / watch ad to unlock
- Expiration countdowns (pulse animation when < 7 days)
- Sonner toast notifications

## Backlog (Next Phases)
### P0
- Quiz mode (4지선다 / 조립 / 필기 + HanziWriter)
- Flashcards (CN-first / KR-first, flip, bookmark, HanziWriter stroke order)
- Bookmark flashcards
- Settings: nickname edit, study stats

### P1
- Mini-games: Word Connection, Fill-in-the-blanks, Sentence Connection, Listen & Find
- Dashboard with study streak, daily stats, accuracy
- Grammar cheat sheet + custom grammar cards
- AI assistant panels (translate, analyze, generate examples) using Emergent LLM key

### P2
- Real AdSense rewarded-ad integration (replace mock)
- Multi-slot merge mode for combined study sessions
- Search/filter within slot items

## Tech Notes
- All backend routes prefixed with `/api`
- MongoDB collections: `users`, `user_sessions`, `slots`, `slot_unlocks`
- Custom `user_id` field used (never expose MongoDB `_id`)
- Datetimes are timezone-aware (UTC), serialized as ISO strings
