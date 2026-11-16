import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, Save, X } from 'lucide-react';
import type {
  AtaMessageSettings,
  MessageRequestPermission,
  UpdateMessageSettingsInput,
} from '../../types';

interface MessagingSettingsProps {
  settings: AtaMessageSettings;
  onSave: (input: UpdateMessageSettingsInput) => Promise<void>;
  onClose?: () => void;
}

export const MessagingSettings: React.FC<MessagingSettingsProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const [allowRequests, setAllowRequests] = useState(settings.allowRequests);
  const [requestPermission, setRequestPermission] =
    useState<MessageRequestPermission>(settings.requestPermission);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(
    settings.readReceiptsEnabled
  );
  const [onlineStatusVisible, setOnlineStatusVisible] = useState(
    settings.onlineStatusVisible
  );
  const [typingIndicatorsEnabled, setTypingIndicatorsEnabled] = useState(
    settings.typingIndicatorsEnabled
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setAllowRequests(settings.allowRequests);
    setRequestPermission(settings.requestPermission);
    setReadReceiptsEnabled(settings.readReceiptsEnabled);
    setOnlineStatusVisible(settings.onlineStatusVisible);
    setTypingIndicatorsEnabled(settings.typingIndicatorsEnabled);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setError(null);
    setSavedNotice(false);
    setIsSaving(true);
    try {
      await onSave({
        allowRequests,
        requestPermission,
        readReceiptsEnabled,
        onlineStatusVisible,
        typingIndicatorsEnabled,
      });
      setSavedNotice(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save messaging privacy settings.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 border-b border-[#D4D7E2] dark:border-[#303342] pb-3">
        <div>
          <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
            Privacy Controls
          </p>
          <h3 className="mt-1 font-display-space font-bold text-lg text-[#090B14] dark:text-white flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
            <span>Messaging Privacy</span>
          </h3>
          <p className="mt-1 text-xs text-[#52576B] dark:text-[#A7A9B8]">
            Control who can initiate message requests and which real-time
            indicators you share.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close privacy settings"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white hover:border-[#EF3038]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
        >
          <AlertCircle
            className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      )}

      {savedNotice && (
        <div className="flex items-center gap-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038] p-3 text-xs font-medium text-[#090B14] dark:text-white">
          <CheckCircle2
            className="h-4 w-4 text-[#EF3038] shrink-0"
            aria-hidden="true"
          />
          <span>Privacy preferences updated.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-start justify-between gap-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-[#090B14] dark:text-white">
              Allow incoming message requests
            </p>
            <p className="mt-0.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
              When disabled, members cannot send you new first-contact requests.
            </p>
          </div>
          <input
            type="checkbox"
            checked={allowRequests}
            onChange={(e) => setAllowRequests(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#EF3038]"
          />
        </label>

        <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 space-y-2">
          <label
            htmlFor="ata-msg-request-permission"
            className="block text-sm font-semibold text-[#090B14] dark:text-white"
          >
            Who can send you message requests
          </label>
          <select
            id="ata-msg-request-permission"
            disabled={!allowRequests}
            value={requestPermission}
            onChange={(e) =>
              setRequestPermission(e.target.value as MessageRequestPermission)
            }
            className="w-full min-h-[42px] rounded-xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs text-[#090B14] dark:text-white disabled:opacity-50 focus:outline-none focus:border-[#EF3038]"
          >
            <option value="everyone">Everyone on ATA (verified members)</option>
            <option value="following">Only accounts you follow</option>
            <option value="mutuals">Only mutual followers</option>
          </select>
        </div>

        <label className="flex items-start justify-between gap-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-[#090B14] dark:text-white">
              Read receipts
            </p>
            <p className="mt-0.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Share when you have read a direct message. Turning this off also
              hides others&apos; read receipts.
            </p>
          </div>
          <input
            type="checkbox"
            checked={readReceiptsEnabled}
            onChange={(e) => setReadReceiptsEnabled(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#EF3038]"
          />
        </label>

        <label className="flex items-start justify-between gap-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-[#090B14] dark:text-white">
              Recently active status
            </p>
            <p className="mt-0.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Show a conservative recent-activity indicator when you are active
              in ATA.
            </p>
          </div>
          <input
            type="checkbox"
            checked={onlineStatusVisible}
            onChange={(e) => setOnlineStatusVisible(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#EF3038]"
          />
        </label>

        <label className="flex items-start justify-between gap-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-[#090B14] dark:text-white">
              Typing indicators
            </p>
            <p className="mt-0.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Let active conversation participants see when you are typing.
            </p>
          </div>
          <input
            type="checkbox"
            checked={typingIndicatorsEnabled}
            onChange={(e) => setTypingIndicatorsEnabled(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#EF3038]"
          />
        </label>

        <div className="pt-1 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#EF3038] border border-[#B92335] text-white text-xs font-semibold hover:bg-[#B92335] disabled:opacity-60 transition-colors"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{isSaving ? 'Saving...' : 'Save Privacy Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
