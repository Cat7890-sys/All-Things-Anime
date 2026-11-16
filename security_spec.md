# ATA Build 02 & Build 03 — Firestore & Storage Security Specification

## 1. Data Invariants

### Build 02 (Accounts & Profiles)
1. **Private PII Isolation**: `users/{uid}` stores `email`, `emailVerified`, and `accountStatus` and is strictly readable only by `request.auth.uid == uid`. `list` queries on `users` are denied.
2. **Public Non-PII Profiles**: `publicProfiles/{uid}` contains only `uid`, `username`, `usernameLowercase`, `displayName`, `bio`, `avatarUrl`, `followersCount`, `followingCount`, `createdAt`, and `updatedAt` (zero email or private flags).
3. **Atomic Username Uniqueness**: `usernames/{usernameLowercase}` is immutable (`update, delete: if false`) and may only be created atomically alongside `users/{uid}` and `publicProfiles/{uid}` when `!exists(...)`.
4. **Immutable Ownership & Identity**: `uid`, `username`, `usernameLowercase`, `email`, and `createdAt` can never be modified after creation.
5. **Verified-Only Profile Editing**: Updating `displayName`, `bio`, or `avatarUrl` requires `request.auth.token.email_verified == true`.
6. **Zero Client Privilege Escalation**: Extra fields (e.g., `isAdmin`, `role`), invalid `accountStatus` transitions, or client-spoofed timestamps (`request.time` enforced) are rejected.

### Build 03 (Social Feed, Reactions, Comments, Follows & Safety)
7. **Verified-Only Social Publishing & Interaction**: Creating, editing, or deleting `posts`, `reactions`, `comments`, `follows`, `blocks`, and `reports` all require `request.auth != null && request.auth.token.email_verified == true`.
8. **Post Ownership & Counter Integrity**:
   - `posts/{postId}` creation requires `authorId == request.auth.uid`, `likeCount == 0`, `commentCount == 0`, `isEdited == false`, `createdAt == request.time`, `content` 1..1500 chars, and atomic `postRateLimits/{uid}` cooldown (`>= 10 seconds`).
   - Author-only edits may only change `content`, `animeTitle`, `hasSpoiler`, `spoilerLabel`, `isEdited: true`, and `updatedAt == request.time`.
   - Non-authors may only increment/decrement `likeCount` (`+/- 1`) atomically with their own `posts/{postId}/reactions/{uid}` doc, or increment/decrement `commentCount` (`+/- 1`) atomically with a `posts/{postId}/comments/{commentId}` create/delete.
9. **Structural Duplicate Reaction Prevention**: `posts/{postId}/reactions/{userId}` enforces `userId == request.auth.uid`, preventing a user from storing more than one reaction document per post.
10. **Comment Ownership & Rate Limits**: `posts/{postId}/comments/{commentId}` enforces `authorId == request.auth.uid`, `1..800` chars, atomic `commentCount` adjustment, and a `4 second` cooldown via `commentRateLimits/{uid}`.
11. **Following & Self-Follow Prevention**: `follows/{followerId}__{followingId}` enforces `followerId == request.auth.uid`, `followerId != followingId`, atomic `followersCount`/`followingCount` delta (`+/- 1`), and blocks tampering with unrelated profile fields.
12. **User Blocking & Moderation Reports**:
    - `blocks/{blockerId}__{blockedId}` is private to `blockerId` (`allow read` only if `blockerId == uid || blockedId == uid`, write only by `blockerId`, no self-block).
    - `reports/{reportId}` is **write-only** from verified clients (`allow read: if false`) so member reports are never exposed publicly; `status` must start as `'open'`.
13. **Storage Rules (`storage.rules`)**: `posts/{userId}/{postId}/{fileName}` and `communities/{userId}/{communityId}/{fileName}` require verified `userId == request.auth.uid`, `size <= 5MB`, and `contentType` matching `image/(jpeg|png|webp|gif)`.

### Build 04A (Anime Communities, RBAC, Private Isolation & Moderation)
14. **Atomic Slug Reservation & Owner Bootstrap**: `communitySlugs/{slug}` is immutable (`update: if false`) and created atomically with `communities/{communityId}` (`ownerId == uid`, `moderatorIds == [uid]`, `memberCount == 1`, `status == 'active'`, `isFeatured == false`), `communityMemberships/{communityId}__{uid}` (`role == 'owner'`), and `communityRateLimits/{uid}` (`>= 30s` cooldown).
15. **Server-Enforced RBAC (Owner / Moderator / Member)**:
    - Only verified Owners can change `visibility`, `status` (`active` / `archived`), permanently delete a community, or promote/demote `moderatorIds` (atomically synced with `communityMemberships.role` via `getAfter`).
    - Only verified Moderators/Owners (`communityMemberships` role in `['owner', 'moderator']`) can edit community details, approve/reject `communityJoinRequests`, or delete another member's posts/comments inside the community.
    - Non-moderators can never modify `moderatorIds`, `role`, `isFeatured`, `ownerId`, or `memberCount` directly.
16. **Private Community Isolation**:
    - `communities/{communityId}/posts/**` (`get`, `list`, `create`, `update`, `delete`) and `communityMemberships` listing for `private` communities require `isCommunityMember(communityId, request.auth.uid)`. Unauthenticated or non-member reads return `PERMISSION_DENIED`.
    - Joining a `private` community directly in `communityMemberships` without an approved `communityJoinRequests` decision by a moderator is denied.
17. **Community Moderation & Reporting**:
    - `reports/{reportId}` supports `targetType: 'community'` (plus `'post'` and `'comment'`) and remains write-only from verified users.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: `PERMISSION_DENIED`)

1. Unauthenticated read of `users/{uid}` -> denied (`isOwner(userId)` fails).
2. Cross-user read of another member's `users/{otherUid}` -> denied (`request.auth.uid != otherUid`).
3. Collection `list` scraping of `users`, `publicProfiles`, `usernames`, or `reports` -> denied.
4. Publishing a post while unverified (`email_verified == false`) or with `authorId != request.auth.uid` -> denied.
5. Publishing a post with forged `likeCount: 500` or bypassing the 10-second `postRateLimits` cooldown -> denied.
6. Editing another user's post or comment -> denied (`existing().authorId != request.auth.uid`).
7. Submitting duplicate likes under `posts/{postId}/reactions/{otherUid}` or modifying `likeCount` by `+10` -> denied.
8. Creating a follow relationship where `followerId == followingId` (self-follow) or `followerId != request.auth.uid` -> denied.
9. Mutating `publicProfiles/{uid}.followersCount` directly without atomically creating/deleting `follows/{uid}__{targetUid}` -> denied.
10. Reading `reports/{reportId}` or `blocks/{otherBlocker}__{someone}` from an unauthorized client -> denied (`reports` read is unconditionally `false`).
11. Creating a `reports/{reportId}` with `status: 'resolved'` or mismatched `reporterId` -> denied.
12. Uploading an executable or oversized (`> 5MB`) file to `posts/{uid}/{postId}/payload.html` -> denied in `storage.rules`.
13. Non-member reading or listing `communities/{privateId}/posts` or `communityMemberships` of a private community -> denied.
14. Non-member creating a self-approved `communityMemberships/{privateId}__{uid}` with `role: 'moderator'` or `role: 'owner'` -> denied.
15. Non-owner attempting to archive/delete a community, change `visibility`, or promote themselves to moderator -> denied.
16. Moderator or member attempting to modify `isFeatured: true`, `memberCount: 9999`, or approve their own `communityJoinRequests` -> denied.
