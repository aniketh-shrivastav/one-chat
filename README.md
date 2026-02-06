# OneChat

Full-stack real-time chat app with a React frontend and an Express + MongoDB backend using Socket.IO.

## Features

- Email/password auth with JWT
- Direct and group messaging with real-time updates
- Presence tracking (online/offline)
- Media uploads stored locally in backend uploads
- Password reset via email (optional SMTP config)

## Tech Stack

- Frontend: React, Socket.IO client, Axios, Tailwind CSS
- Backend: Node.js (Express), MongoDB (Mongoose), Socket.IO

## Project Structure

```
backend/   # API + Socket.IO server
frontend/  # React web app
```

## Quick Start

### 1) Backend

```
cd backend
npm install
```

Create backend/.env:

```
MONGO_URI=mongodb://localhost:27017/onechat
JWT_SECRET=replace_with_a_long_random_string
CLIENT_ORIGIN=http://localhost:3000
PORT=5000

# Optional mailer settings (for password reset emails)
MAIL_HOST=
MAIL_PORT=587
MAIL_SECURE=0
MAIL_USER=
MAIL_PASS=
MAIL_FROM=no-reply@onechat.local
MAIL_REQUIRE_SMTP=0
MAIL_MAX_PER_HOUR=30
```

Start the server:

```
npm run start
```

### 2) Frontend

```
cd frontend
npm install
```

Create frontend/.env (optional, defaults shown):

```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

Start the app:

```
npm start
```

## Tests

Backend:

```
cd backend
npm test
```

Frontend:

```
cd frontend
npm test
```

## Documentation

- Backend chat feature details: backend/CHAT_FEATURE.md

## Notes

- The backend serves uploaded files from backend/uploads.
- If port 5000 is busy, the backend will try the next available ports automatically.
