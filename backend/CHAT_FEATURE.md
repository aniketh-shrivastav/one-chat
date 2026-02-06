# Chat Feature Overview

This document summarizes the chat system implemented in this project: data models, REST endpoints, real-time events, and future improvements.

## Data Models

### User

Standard auth user with fields: `username`, `email`, `password` (hashed). Used as sender and direct message peer.

### Group

```
{
  _id: ObjectId,
  group_name: String,
  members: [ObjectId(User)],
  createdBy: ObjectId(User),
  admins: [ObjectId(User)],
  lastMessage: ObjectId(Message),
  createdAt, updatedAt
}
```

Any authenticated user can create a group; creator is auto-added as member/admin.

### Message

Polymorphic message referencing either a Group or a User via `receiverType` and `receiver`.

```
{
  _id: ObjectId,
  sender: ObjectId(User),
  receiverType: 'Group' | 'User',
  receiver: ObjectId(Group|User),
  message_text: String,
  status: 'sent' | 'delivered' | 'read',
  readBy: [ObjectId(User)], // includes sender for group messages
  timestamp: Date
}
```

Indexes: sender, receiver, receiverType, timestamp for efficient queries.

## REST Endpoints (Base: `/api/chat`)

| Method | Path                          | Description                                              |
| ------ | ----------------------------- | -------------------------------------------------------- |
| POST   | /groups                       | Create group (body: `group_name`, optional `members[]`)  |
| GET    | /groups                       | List groups current user is member of                    |
| GET    | /groups/unread-counts         | Approximate unread counts per group                      |
| POST   | /groups/:groupId/members      | Add member (must already be a member)                    |
| POST   | /groups/:groupId/leave        | Leave group                                              |
| POST   | /groups/:groupId/promote      | Promote member to admin (admin only)                     |
| GET    | /users                        | List users (basic info) for direct chat selection        |
| POST   | /messages/direct              | Send a direct message (body: `toUserId`, `message_text`) |
| POST   | /messages/group               | Send a group message (body: `groupId`, `message_text`)   |
| GET    | /messages/direct/:otherUserId | Fetch direct conversation messages                       |
| GET    | /messages/group/:groupId      | Fetch group messages                                     |
| POST   | /messages/mark-read           | Mark messages read (body: `messageIds[]`)                |

All endpoints secured by JWT auth middleware (Authorization: Bearer <token>).

## Real-Time (Socket.IO)

Namespace: default.
Client authenticates by passing `token` in connection query.

Events emitted TO client:

- `connection:ack` – successful socket auth.
- `group:new` – new group created that user is a member of.
- `group:updated` – membership/admin changes or lastMessage updated.
- `message:new` – new direct or group message (payload is Message doc).
- `messages:read` – (currently emitted to reader only) indicates read update (can be extended to broadcast to peers).

Client emits nothing custom yet (server relies on REST for actions). Future improvement: optimistic events for typing, presence.

## Frontend Behavior

- Tabs: Groups / Direct.
- Unread counts maintained separately for groups and direct peers.
- Selecting a conversation fetches last 100 messages and immediately marks unread ones read via `/messages/mark-read`.
- Real-time incoming messages for the active conversation are appended and marked read instantly.
- Group creation modal allows quick creation with only a name (creator auto-added/admin).

## Read Receipts

Current strategy: minimal – client marks messages read when opening a conversation or receiving them while focused. Server updates `readBy` and sets `status: 'read'`. Enhancement opportunity: broadcast `messages:read` to other participants so their UI can reflect read ticks.

## Security Notes

- JWT checked on every REST call and socket handshake.
- Group membership verified before sending or fetching group messages.
- Direct messaging prevents sending messages to self.
- No file uploads yet – reduces attack surface.

## Performance Considerations

- Pagination supported via `?limit` and `before` parameters (foundation present in backend); frontend currently fetches last 100.
- Indexes on message query fields reduce scanning cost.
- Unread counts endpoint is approximate (aggregates across all groups; does not filter by membership). In production you'd refine with `$lookup` or maintain a separate per-user unread counter collection.

## Potential Enhancements

1. Presence & typing indicators (socket rooms per group/user pair).
2. Broadcast read receipts to other participants.
3. Refined unread counts filtered by membership + incremental counters.
4. Message deletion / editing with audit trail.
5. Attachment & image handling (S3 / Cloud storage signed URLs).
6. Rate limiting & spam detection (e.g., per-minute message quotas).
7. Full-text search (MongoDB Atlas Search or Elastic integration).
8. Infinite scrolling (use `before` cursor pagination).
9. Better error surfaces (toast system instead of silent catches).
10. E2E encryption layer (double-ratchet) – major architectural shift.

## Testing Guidance

Planned test suite (Jest + Supertest):

- Auth: signup & login (token issuance).
- Group: create, list, add member, leave.
- Messaging: send group & direct messages; retrieval order; mark-read effect.
- Security: cannot fetch or send to group not a member of; cannot DM self.

## Maintenance

- Run `npm run audit:quick` (frontend/backend) regularly for vulnerability check.
- Keep dependencies updated with minor/patch updates; stage major updates with tests.

---

Last updated: 2025-09-26
