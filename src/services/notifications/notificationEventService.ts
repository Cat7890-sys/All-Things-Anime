/**
 * Notification creation was migrated from client-side Firestore writes to
 * trusted Firebase Cloud Functions using the Admin SDK (`functions/src/triggers/*`).
 *
 * Clients must never create documents in `/notifications/{notificationId}`;
 * `firestore.rules` enforces `allow create: if false;` on notifications.
 */
export {};
