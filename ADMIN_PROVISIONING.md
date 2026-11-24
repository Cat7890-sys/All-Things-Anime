# ATA Administrator Provisioning & Governance Runbook

All Things Anime (ATA) enforces a **strict maximum of 3 server-verified administrator seats** (`owner`, `platform_admin`, `content_admin`). There are **no** hardcoded credentials, default admin passwords, or client-side self-promotion paths anywhere in the codebase.

---

## Target Firebase Infrastructure

- **Firebase Project ID**: `causal-truth-2dx1j`
- **Named Cloud Firestore Database**: `ai-studio-ataallthingsanim-42a903d6-0b6a-478d-9d62-c82df4c9e0e2`
  - **CRITICAL**: Never target the `(default)` Firestore database.
  - **CRITICAL**: Never access or modify the separate Birthday Countdown project.

---

## Step 1 — Create & Verify the Owner Account in Firebase Authentication

1. Open the Firebase Console for project **`causal-truth-2dx1j`**.
2. Go to **Authentication -> Users**.
3. Sign in once with the Owner's personal email address in the ATA app (or create the user in Authentication) and ensure **Email Verified** is `true`.
4. Copy the Owner's **User UID** (e.g. `<OWNER_UID>`).

---

## Step 2 — Bootstrap Admin Seat 1 (Owner) in the Named Firestore Database

In the Firebase Console, go to **Firestore Database**, switch the database selector to **`ai-studio-ataallthingsanim-42a903d6-0b6a-478d-9d62-c82df4c9e0e2`**, and create these two documents:

### 2A. Document `admins/<OWNER_UID>`

```json
{
  "uid": "<OWNER_UID>",
  "seatId": "owner",
  "role": "owner",
  "displayLabel": "Owner / Super Admin",
  "email": "<OWNER_EMAIL>",
  "permissions": [
    "user_management",
    "account_moderation",
    "user_reports",
    "content_moderation",
    "community_management",
    "copyright_complaints",
    "user_feedback",
    "announcements",
    "platform_statistics",
    "operational_monitoring",
    "catalogue_management",
    "metadata_corrections",
    "featured_content",
    "seasonal_displays",
    "anime_news",
    "recommendations",
    "where_to_watch",
    "country_availability",
    "streaming_verification",
    "legal_compliance",
    "security_incidents",
    "admin_management",
    "audit_logs",
    "system_health"
  ],
  "status": "active",
  "assignedByUid": "<OWNER_UID>"
}
```
*(Set `assignedAt` and `updatedAt` to Server Timestamps in the console.)*

### 2B. Document `adminSeats/owner`

```json
{
  "seatId": "owner",
  "uid": "<OWNER_UID>",
  "role": "owner",
  "displayLabel": "Owner / Super Admin",
  "email": "<OWNER_EMAIL>",
  "permissions": [
    "user_management",
    "account_moderation",
    "user_reports",
    "content_moderation",
    "community_management",
    "copyright_complaints",
    "user_feedback",
    "announcements",
    "platform_statistics",
    "operational_monitoring",
    "catalogue_management",
    "metadata_corrections",
    "featured_content",
    "seasonal_displays",
    "anime_news",
    "recommendations",
    "where_to_watch",
    "country_availability",
    "streaming_verification",
    "legal_compliance",
    "security_incidents",
    "admin_management",
    "audit_logs",
    "system_health"
  ],
  "status": "active",
  "assignedByUid": "<OWNER_UID>"
}
```
*(Set `assignedAt` and `updatedAt` to Server Timestamps.)*

---

## Step 3 — Deploy Rules, Indexes & Cloud Functions

Run these commands locally when ready to publish to Firebase (ensure you are authenticated with `firebase login` and targeting `causal-truth-2dx1j`):

```bash
# 1. Build Cloud Functions TypeScript sources
npm --prefix functions run build

# 2. Deploy Firestore Rules, Storage Rules, Indexes, and Cloud Functions
firebase deploy --project causal-truth-2dx1j --only firestore:rules,firestore:indexes,storage,functions
```

> **Note**: Cloud Functions in `/functions/src/firebase.ts` explicitly connect to the named database `ai-studio-ataallthingsanim-42a903d6-0b6a-478d-9d62-c82df4c9e0e2` via `getFirestore(app, 'ai-studio-ataallthingsanim-42a903d6-0b6a-478d-9d62-c82df4c9e0e2')`.

---

## Step 4 — Verify & Provision Admin Seats 2 and 3 (Optional)

1. Navigate to `/All-Things-Anime/admin/login` (or click **Administrator Portal** in the footer).
2. Sign in with the Owner account created in Step 1.
3. Open **Overview** and **Admin Seats & Logs** in the Admin Dashboard.
4. Click **Reauthenticate** and confirm the Owner password.
5. Assign **Seat 2 (`platform_admin`)** and/or **Seat 3 (`content_admin`)** by entering the target staff member's existing verified Firebase Auth UID, choosing their custom permission subset, and clicking **Apply Seat Configuration**.
6. Cloud Function `adminManageSeatAndPermissions` automatically writes `admins/{uid}`, updates `adminSeats/{seatId}`, sets Firebase Auth custom claims (`ataAdmin`, `ataRole`, `ataSeatId`), and records an immutable entry in `adminAuditLogs`.

---

## Step 5 — Complete Legal Operator Placeholders

Before commercial or broad public operation, search for `[OWNER ACTION REQUIRED` in `src/services/legal/legalConfig.ts` and replace the placeholders with your verified legal entity / proprietor name, registration number, physical service address, POPIA Information Officer name, and dedicated legal/takedown email addresses.
