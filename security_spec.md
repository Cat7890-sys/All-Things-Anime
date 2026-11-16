# ATA Build 02 — Firestore Security Specification

## 1. Data Invariants

1. **Private PII Isolation**: `users/{uid}` stores `email`, `emailVerified`, and `accountStatus` and is strictly readable only by `request.auth.uid == uid`. `list` queries on `users` are denied.
2. **Public Non-PII Profiles**: `publicProfiles/{uid}` contains only `uid`, `username`, `usernameLowercase`, `displayName`, `bio`, `avatarUrl`, `createdAt`, and `updatedAt` (zero email or private flags).
3. **Atomic Username Uniqueness**: `usernames/{usernameLowercase}` is immutable (`update, delete: if false`) and may only be created atomically alongside `users/{uid}` and `publicProfiles/{uid}` when `!exists(...)`.
4. **Immutable Ownership & Identity**: `uid`, `username`, `usernameLowercase`, `email`, and `createdAt` can never be modified after creation.
5. **Verified-Only Profile Editing**: Updating `displayName`, `bio`, or `avatarUrl` requires `request.auth.token.email_verified == true`.
6. **Zero Client Privilege Escalation**: Extra fields (e.g., `isAdmin`, `role`), invalid `accountStatus` transitions, or client-spoofed timestamps (`request.time` enforced) are rejected.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: `PERMISSION_DENIED`)

1. Unauthenticated read of `users/{uid}` -> denied (`isOwner(userId)` fails).
2. Cross-user read of another member's `users/{otherUid}` -> denied (`request.auth.uid != otherUid`).
3. Collection `list` scraping of `users`, `publicProfiles`, or `usernames` -> denied (`allow list: if false`).
4. Creating `users/{uid}` with `accountStatus: 'active'` or `emailVerified: true` -> denied on `create`.
5. Creating `users/{uid}` with shadow admin field `role: 'admin'` -> denied (`keys().hasOnly(...)`).
6. Creating `users/{uid}` with another user's email or mismatched `uid` -> denied.
7. Creating `usernames/{handle}` without atomic `users/{uid}` + `publicProfiles/{uid}` -> denied (`existsAfter`).
8. Overwriting or deleting an existing `usernames/{handle}` -> denied (`update, delete: if false`).
9. Updating `users/{uid}` while `request.auth.token.email_verified == false` -> denied (`isEmailVerified()`).
10. Updating `users/{uid}` to mutate `username`, `usernameLowercase`, `uid`, `email`, or `createdAt` -> denied.
11. Updating `users/{uid}` with `bio` > 280 chars or non-`https://` `avatarUrl` (e.g., `javascript:alert(1)`) -> denied.
12. Updating `users/{uid}` with client-forged `updatedAt` timestamp instead of `request.time` -> denied.
