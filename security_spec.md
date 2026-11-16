# ATA Build 02–04B — Firestore & Storage Security Specification

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
17. **Community & Messaging Moderation Reporting**:
    - `reports/{reportId}` supports `targetType` in `['post', 'comment', 'community', 'message', 'conversation']` and remains strictly write-only from verified users.

### Build 04B (Private Messaging, Message Requests, Group RBAC & Privacy Controls)
18. **Strict Participant-Only Conversation Access**:
    - `/conversations/{conversationId}`, `/conversations/{conversationId}/messages/{messageId}`, `/conversations/{conversationId}/typing/{userId}`, and `/conversationMembers/{conversationId}__{userId}` are never publicly readable or discoverable.
    - Only users currently present in `conversation.participantIds` (bounded `<= 25`) can read or write; removed or departed group members lose read/write access synchronously upon removal from `participantIds`.
19. **Message Request Privacy & Anti-Spam State Machine**:
    - Creating `/messageRequests/{senderId}__{recipientId}` requires verified auth, non-self target, `!isBlockedBetween(senderId, recipientId)`, recipient's `messageSettings.allowRequests == true`, and satisfaction of `requestPermission` (`everyone | following | mutuals`) checked against `/follows` in Firestore rules.
    - Only the recipient can transition `pending -> accepted | declined`, and only the sender can transition `pending -> cancelled`. A `declined` request can never be overwritten back to `pending` by the sender.
    - Direct conversation creation requires recipient acceptance of a `pending` request in the same transaction (`getAfter(/messageRequests/{reqId}).data.status == 'accepted'`).
20. **Message Immutability, 15-Minute Edit Window & Deletion Tombstones**:
    - Messages enforce `senderId == request.auth.uid`, `createdAt == request.time`, and `editedAt == null, deletedAt == null` on create.
    - Editing own `'text'` message is restricted to `request.time <= existing().createdAt + duration.value(15, 'm')`, `existing().deletedAt == null`, and `affectedKeys().hasOnly(['text', 'editedAt'])`.
    - Deleting own message writes a tombstone (`deletedAt == request.time`, `text == ''`) while preserving reply context integrity; hard deletion is denied.
21. **Group Conversation RBAC & Unread Counter Integrity**:
    - Only group `owner` or `admin` can add/remove members or update group metadata; only `owner` can promote/demote `adminIds` (synced with `conversationMembers.role`), archive, or delete the group. Owners cannot leave without deleting the group.
    - Only the owner of a `conversationMembers` doc can reset `unreadCount` to `0` and update `lastReadAt`, `muted`, or `archived`; other active participants may only increment `unreadCount` by `+1` on message send.

## 2. Adversarial "Dirty Dozen+" Payloads (Expected: `PERMISSION_DENIED`)

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
17. Non-participant attempting to `get` or `list` `/conversations/{cid}` or `/conversations/{cid}/messages` -> denied.
18. Blocked user or sender violating `messageSettings` (`allowRequests: false`, `following`, `mutuals`) attempting to create `/messageRequests/{sender}__{recipient}` -> denied.
19. Sender attempting to overwrite a `declined` message request back to `pending`, or forge a direct `/conversations/dm__...` without recipient acceptance -> denied.
20. Sender attempting to edit another user's message, edit own message after 15 minutes, or forge a `system` message `senderId` -> denied.
21. Removed group member attempting to read subsequent messages, send a message, or update typing state -> denied.
22. Non-admin group member attempting to add/remove participants, edit group details, or promote themselves to `admin` -> denied.
23. Participant attempting to reset another participant's `unreadCount` to `0` or forge arbitrary `unreadCount` -> denied.
