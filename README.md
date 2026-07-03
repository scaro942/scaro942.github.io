# Chinese Learning Slots App

A web app for Korean learners studying Chinese (HSK / conversation). Organize vocabulary and sentences into "slots" by textbook or chapter, then practice with quizzes, flashcards, and mini-games.

## Features

- Google login (with an anonymous, localStorage-only mode as fallback)
- 10 learning slots (3 free + 7 unlockable via ad-watch, 60-day access)
- Word and sentence modes with bulk add, quiz, flashcard, and mini-game practice
- Export/import slot data as JSON, with slot-capacity validation on import

## Tech Stack

- **Frontend:** React 19, Tailwind CSS, shadcn/ui
- **Backend:** FastAPI, MongoDB (via Motor)

## Getting Started

### Frontend

```bash
cd frontend
yarn install
yarn start
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```

The backend expects a `.env` file in `backend/` with `MONGO_URL` and `DB_NAME` set.
