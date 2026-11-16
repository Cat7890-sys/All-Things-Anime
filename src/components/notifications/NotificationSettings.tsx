import React, { useEffect, useState } from 'react';
import { Bell, Check, Clock, Globe, Shield, Volume2, Save, Loader2, AlertCircle } from 'lucide-react';
import type { AtaNotificationSettings, UpdateNotificationSettingsInput } from '../../types';
import {
  getNotificationSettings,
  updateNotificationSettings,
} from '../../services/notifications/notificationSettingsService';

interface NotificationSettingsProps {
  currentUserId?: string;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ currentUserId }) => {
  const [settings, setSettings] = useState<AtaNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    getNotificationSettings(currentUserId)
      .then((data) => {
        if (isMounted) {
          setSettings(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load notification settings.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  const handleToggle = async (key: keyof UpdateNotificationSettingsInput, value: boolean | string) => {
    if (!settings || !currentUserId) return;
    const updatedInput = { ...settings, [key]: value };
    setSettings(updatedInput as AtaNotificationSettings);
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateNotificationSettings(currentUserId, {
        [key]: value,
      });
      setSuccessMessage('Preferences updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#EF3038]" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-[#EF3038] mx-auto" />
        <p className="text-sm font-semibold text-[#090B14] dark:text-white">
          Please sign in to configure notification preferences.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {error && (
        <div className="p-4 rounded-xl bg-[#EF3038]/10 border border-[#EF3038]/30 text-xs text-[#EF3038] font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 font-medium flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Master Toggle */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#EF3038]" />
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Master Notifications
            </h3>
          </div>
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
            Enable or pause all notifications across ATA.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => void handleToggle('enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-[#D4D7E2] peer-focus:outline-none rounded-full peer dark:bg-[#303342] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D4D7E2] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#EF3038]"></div>
        </label>
      </div>

      {/* Categories */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-5">
        <div className="border-b border-[#D4D7E2] dark:border-[#303342] pb-3">
          <h4 className="text-xs font-accent-orbitron font-bold tracking-wider text-[#090B14] dark:text-white uppercase">
            Notification Categories
          </h4>
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
            Choose which types of activities trigger alerts.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { key: 'socialEnabled', label: 'Social & Discussions', desc: 'Likes, comments, and replies on your posts' },
            { key: 'followersEnabled', label: 'Followers', desc: 'New members who follow your profile' },
            { key: 'communitiesEnabled', label: 'Communities', desc: 'Membership requests, join approvals, and updates' },
            { key: 'messagingEnabled', label: 'Direct Messages & Requests', desc: 'New messages and message requests' },
            { key: 'groupsEnabled', label: 'Groups', desc: 'Group chat messages and membership changes' },
            { key: 'systemEnabled', label: 'System & Announcements', desc: 'Platform announcements and maintenance notices' },
          ].map((item) => {
            const checked = Boolean(settings[item.key as keyof AtaNotificationSettings]);
            return (
              <div key={item.key} className="flex items-center justify-between py-1">
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs font-bold text-[#090B14] dark:text-white">
                    {item.label}
                  </p>
                  <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                    {item.desc}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    disabled={!settings.enabled}
                    checked={checked}
                    onChange={(e) => void handleToggle(item.key as keyof UpdateNotificationSettingsInput, e.target.checked)}
                    className="sr-only peer disabled:opacity-50"
                  />
                  <div className="w-9 h-5 bg-[#D4D7E2] peer-focus:outline-none rounded-full peer dark:bg-[#303342] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D4D7E2] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#EF3038] peer-disabled:opacity-40"></div>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Popups & Quiet Hours */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-5">
        <div className="border-b border-[#D4D7E2] dark:border-[#303342] pb-3">
          <h4 className="text-xs font-accent-orbitron font-bold tracking-wider text-[#090B14] dark:text-white uppercase">
            Delivery & Quiet Hours
          </h4>
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
            Configure real-time pop-up toasts and automated quiet hours.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-[#090B14] dark:text-white">
                In-App Pop-up Toasts
              </p>
              <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                Show floating toast notifications when alerts arrive in real time
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                disabled={!settings.enabled}
                checked={settings.popupEnabled}
                onChange={(e) => void handleToggle('popupEnabled', e.target.checked)}
                className="sr-only peer disabled:opacity-50"
              />
              <div className="w-9 h-5 bg-[#D4D7E2] peer-focus:outline-none rounded-full peer dark:bg-[#303342] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D4D7E2] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#EF3038] peer-disabled:opacity-40"></div>
            </label>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#D4D7E2]/50 dark:border-[#303342]/50">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#EF3038]" />
                <p className="text-xs font-bold text-[#090B14] dark:text-white">
                  Quiet Hours
                </p>
              </div>
              <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                Suppress pop-up toasts during scheduled night hours
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                disabled={!settings.enabled}
                checked={settings.quietHoursEnabled}
                onChange={(e) => void handleToggle('quietHoursEnabled', e.target.checked)}
                className="sr-only peer disabled:opacity-50"
              />
              <div className="w-9 h-5 bg-[#D4D7E2] peer-focus:outline-none rounded-full peer dark:bg-[#303342] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D4D7E2] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#EF3038] peer-disabled:opacity-40"></div>
            </label>
          </div>

          {settings.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8] mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={settings.quietHoursStart}
                  onChange={(e) => void handleToggle('quietHoursStart', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8] mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={settings.quietHoursEnd}
                  onChange={(e) => void handleToggle('quietHoursEnd', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
                />
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[#D4D7E2]/50 dark:border-[#303342]/50 flex items-center justify-between text-xs text-[#52576B] dark:text-[#A7A9B8]">
            <div className="flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-[#EF3038]" />
              <span>Timezone: {settings.timezone}</span>
            </div>
            {saving && (
              <span className="flex items-center gap-1 text-[11px] text-[#EF3038]">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
