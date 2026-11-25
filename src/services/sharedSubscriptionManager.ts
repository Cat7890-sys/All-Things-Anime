import type { Unsubscribe } from 'firebase/firestore';
import {
  recordConsumerDetached,
  recordListenerCleanedUp,
  recordListenerCreated,
  recordSharedConsumerAttached,
} from './firestoreDiagnostics';

interface ConsumerEntry<T> {
  onData: (data: T) => void;
  onError?: (message: string) => void;
}

interface SharedChannel<T> {
  key: string;
  module: string;
  uid?: string;
  consumers: Map<number, ConsumerEntry<T>>;
  teardown: Unsubscribe | null;
  hasValue: boolean;
  lastValue?: T;
  lastError?: string;
  isDisposed: boolean;
}

const activeChannels = new Map<string, SharedChannel<unknown>>();
let nextConsumerId = 1;

export interface SubscribeSharedOptions {
  /** Optional owner UID so logout/account switch cleans up user-scoped listeners cleanly. */
  uid?: string;
}

/**
 * Attaches a consumer to a key-scoped real-time listener.
 * Multiple consumers requesting the same `key` share one underlying Firestore
 * subscription via reference counting, receiving cached latest data immediately
 * and tearing down the underlying listener automatically when the last consumer
 * unsubscribes.
 */
export function subscribeShared<T>(
  key: string,
  moduleName: string,
  createUnderlyingListener: (
    emitData: (value: T) => void,
    emitError: (message: string) => void
  ) => Unsubscribe,
  onData: (value: T) => void,
  onError?: (message: string) => void,
  options?: SubscribeSharedOptions
): Unsubscribe {
  let channel = activeChannels.get(key) as SharedChannel<T> | undefined;
  const consumerId = nextConsumerId++;

  if (channel && channel.uid !== options?.uid) {
    channel.isDisposed = true;
    channel.consumers.clear();
    activeChannels.delete(key);
    try {
      channel.teardown?.();
    } finally {
      recordListenerCleanedUp(key);
    }
    channel = undefined;
  }

  if (!channel) {
    const newChannel: SharedChannel<T> = {
      key,
      module: moduleName,
      uid: options?.uid,
      consumers: new Map(),
      teardown: null,
      hasValue: false,
      isDisposed: false,
    };
    channel = newChannel;
    activeChannels.set(key, newChannel as SharedChannel<unknown>);
    newChannel.consumers.set(consumerId, { onData, onError });
    recordListenerCreated(key, moduleName, 1);

    const emitData = (value: T) => {
      if (newChannel.isDisposed || activeChannels.get(key) !== newChannel) {
        return;
      }
      newChannel.hasValue = true;
      newChannel.lastValue = value;
      newChannel.lastError = undefined;
      for (const consumer of Array.from(newChannel.consumers.values())) {
        consumer.onData(value);
      }
    };

    const emitError = (message: string) => {
      if (newChannel.isDisposed || activeChannels.get(key) !== newChannel) {
        return;
      }
      newChannel.lastError = message;
      for (const consumer of Array.from(newChannel.consumers.values())) {
        consumer.onError?.(message);
      }
    };

    try {
      const teardown = createUnderlyingListener(emitData, emitError);
      // Handle rare case where consumer already unsubscribed synchronously inside setup
      if (newChannel.isDisposed || newChannel.consumers.size === 0) {
        teardown();
        activeChannels.delete(key);
        recordListenerCleanedUp(key);
      } else {
        newChannel.teardown = teardown;
      }
    } catch (err) {
      activeChannels.delete(key);
      recordListenerCleanedUp(key);
      throw err;
    }
  } else {
    channel.consumers.set(consumerId, { onData, onError });
    recordSharedConsumerAttached(key, moduleName, channel.consumers.size);

    if (channel.hasValue) {
      onData(channel.lastValue as T);
    } else if (channel.lastError) {
      onError?.(channel.lastError);
    }
  }

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;

    const current = activeChannels.get(key) as SharedChannel<T> | undefined;
    if (!current || current !== channel) {
      return;
    }

    current.consumers.delete(consumerId);
    recordConsumerDetached(key, current.consumers.size);

    if (current.consumers.size === 0) {
      current.isDisposed = true;
      activeChannels.delete(key);
      try {
        current.teardown?.();
      } finally {
        recordListenerCleanedUp(key);
      }
    }
  };
}

export function getSharedSubscriptionCount(): number {
  return activeChannels.size;
}

export function getSharedChannelConsumerCount(key: string): number {
  return activeChannels.get(key)?.consumers.size ?? 0;
}

export function clearUserSharedSubscriptions(uid: string): void {
  if (!uid) return;
  for (const [key, channel] of Array.from(activeChannels.entries())) {
    if (channel.uid === uid) {
      channel.isDisposed = true;
      channel.consumers.clear();
      activeChannels.delete(key);
      try {
        channel.teardown?.();
      } finally {
        recordListenerCleanedUp(key);
      }
    }
  }
}

export function clearAllSharedSubscriptions(): void {
  for (const [key, channel] of Array.from(activeChannels.entries())) {
    channel.isDisposed = true;
    channel.consumers.clear();
    activeChannels.delete(key);
    try {
      channel.teardown?.();
    } finally {
      recordListenerCleanedUp(key);
    }
  }
}
