/**
 * Safe development-mode Firestore listener diagnostics.
 * - Zero Firestore reads generated.
 * - Zero PII, tokens, or document payloads logged.
 * - No-op in production builds (`import.meta.env.DEV === false`).
 */

export interface ActiveListenerDiagnosticEntry {
  key: string;
  module: string;
  consumerCount: number;
  createdAtMs: number;
  lastUpdatedAtMs: number;
}

export interface FirestoreDiagnosticsSnapshot {
  enabled: boolean;
  activeCount: number;
  totalListenersCreated: number;
  totalSubscriptionsReused: number;
  totalListenersCleanedUp: number;
  duplicateWarningsCount: number;
  activeListeners: ActiveListenerDiagnosticEntry[];
}

const DUPLICATE_DIRECT_WARNING_THRESHOLD = 1;
const HIGH_ACTIVE_LISTENER_THRESHOLD = 14;

export function isDiagnosticsEnabled(): boolean {
  try {
    const meta = import.meta as unknown as {
      env?: { DEV?: boolean; MODE?: string };
    };
    if (meta && meta.env) {
      return Boolean(meta.env.DEV || meta.env.MODE === 'test');
    }
  } catch {
    // Ignore when import.meta.env is unavailable
  }
  return (
    typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'
  );
}

/**
 * Redacts user/document identifiers from keys before console logging so no
 * user-identifying values appear in diagnostic output.
 */
export function sanitizeDiagnosticKey(rawKey: string): string {
  const parts = rawKey.split(':');
  if (parts.length <= 1) return rawKey;
  return parts
    .map((part, idx) => {
      if (idx === 0) return part;
      if (part.length <= 10) return part;
      return `${part.slice(0, 4)}…`;
    })
    .join(':');
}

const activeListeners = new Map<string, ActiveListenerDiagnosticEntry>();
let totalListenersCreated = 0;
let totalSubscriptionsReused = 0;
let totalListenersCleanedUp = 0;
let duplicateWarningsCount = 0;
let highWatermarkWarned = false;

export function recordListenerCreated(
  key: string,
  moduleName: string,
  consumerCount: number = 1
): void {
  if (!isDiagnosticsEnabled()) return;

  const now = Date.now();
  if (activeListeners.has(key)) {
    duplicateWarningsCount += 1;
    if (duplicateWarningsCount <= 25) {
      console.warn(
        `[ATA Firestore Diagnostics] Duplicate unshared listener detected for "${sanitizeDiagnosticKey(key)}" (${moduleName}).`
      );
    }
  }

  activeListeners.set(key, {
    key: sanitizeDiagnosticKey(key),
    module: moduleName,
    consumerCount,
    createdAtMs: now,
    lastUpdatedAtMs: now,
  });
  totalListenersCreated += 1;

  if (
    !highWatermarkWarned &&
    activeListeners.size >= HIGH_ACTIVE_LISTENER_THRESHOLD
  ) {
    highWatermarkWarned = true;
    console.warn(
      `[ATA Firestore Diagnostics] High active listener count (${activeListeners.size}).`
    );
  }
}

export function recordSharedConsumerAttached(
  key: string,
  moduleName: string,
  consumerCount: number
): void {
  if (!isDiagnosticsEnabled()) return;
  totalSubscriptionsReused += 1;
  const existing = activeListeners.get(key);
  if (existing) {
    existing.consumerCount = consumerCount;
    existing.lastUpdatedAtMs = Date.now();
  } else {
    activeListeners.set(key, {
      key: sanitizeDiagnosticKey(key),
      module: moduleName,
      consumerCount,
      createdAtMs: Date.now(),
      lastUpdatedAtMs: Date.now(),
    });
  }
  if (consumerCount > 10 && DUPLICATE_DIRECT_WARNING_THRESHOLD > 0) {
    console.warn(
      `[ATA Firestore Diagnostics] High consumer fan-out (${consumerCount}) on "${sanitizeDiagnosticKey(key)}" (${moduleName}).`
    );
  }
}

export function recordConsumerDetached(key: string, remainingCount: number): void {
  if (!isDiagnosticsEnabled()) return;
  const existing = activeListeners.get(key);
  if (existing) {
    existing.consumerCount = Math.max(0, remainingCount);
    existing.lastUpdatedAtMs = Date.now();
  }
}

export function recordListenerCleanedUp(key: string): void {
  if (!isDiagnosticsEnabled()) return;
  if (activeListeners.delete(key)) {
    totalListenersCleanedUp += 1;
  }
  if (activeListeners.size < HIGH_ACTIVE_LISTENER_THRESHOLD / 2) {
    highWatermarkWarned = false;
  }
}

export function getFirestoreDiagnosticsSnapshot(): FirestoreDiagnosticsSnapshot {
  const enabled = isDiagnosticsEnabled();
  return {
    enabled,
    activeCount: activeListeners.size,
    totalListenersCreated,
    totalSubscriptionsReused,
    totalListenersCleanedUp,
    duplicateWarningsCount,
    activeListeners: Array.from(activeListeners.values()).map((entry) => ({
      ...entry,
    })),
  };
}

export function resetFirestoreDiagnostics(): void {
  activeListeners.clear();
  totalListenersCreated = 0;
  totalSubscriptionsReused = 0;
  totalListenersCleanedUp = 0;
  duplicateWarningsCount = 0;
  highWatermarkWarned = false;
}

if (typeof window !== 'undefined' && isDiagnosticsEnabled()) {
  (
    window as unknown as {
      __ATA_FIRESTORE_DIAGNOSTICS__?: () => FirestoreDiagnosticsSnapshot;
    }
  ).__ATA_FIRESTORE_DIAGNOSTICS__ = getFirestoreDiagnosticsSnapshot;
}
