import React, { useEffect, useState } from 'react';
import { AlertTriangle, Megaphone, ShieldAlert, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchActivePlatformAnnouncements } from '../../services/legal/legalService';
import type { PlatformAnnouncement } from '../../types';

export const AnnouncementBanner: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    void fetchActivePlatformAnnouncements(firebaseUser?.uid).then((items) => {
      if (active) setAnnouncements(items);
    });
    return () => {
      active = false;
    };
  }, [firebaseUser?.uid]);

  const visible = announcements.filter((a) => !dismissedIds.has(a.id));
  if (visible.length === 0) return null;

  const topNotice = visible[0];

  const getStyle = (kind: PlatformAnnouncement['kind']) => {
    if (kind === 'maintenance') {
      return {
        border: 'border-amber-500/60 bg-amber-500/10 text-amber-950 dark:text-amber-100',
        Icon: AlertTriangle,
        iconColor: 'text-amber-600 dark:text-amber-400',
        label: 'Maintenance Notice',
      };
    }
    if (kind === 'safety') {
      return {
        border: 'border-[#EF3038] bg-[#EF3038]/10 text-[#090B14] dark:text-white',
        Icon: ShieldAlert,
        iconColor: 'text-[#EF3038]',
        label: 'Safety Advisory',
      };
    }
    if (kind === 'feature') {
      return {
        border: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100',
        Icon: Sparkles,
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        label: 'Platform Update',
      };
    }
    return {
      border: 'border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] text-[#090B14] dark:text-white',
      Icon: Megaphone,
      iconColor: 'text-[#EF3038]',
      label: 'Announcement',
    };
  };

  const style = getStyle(topNotice.kind);
  const Icon = style.Icon;

  return (
    <div className="mb-5">
      <div
        role="region"
        aria-label="Platform announcement"
        className={`rounded-2xl border px-4 py-3 flex items-start justify-between gap-3 ${style.border}`}
      >
        <div className="flex items-start gap-3">
          <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${style.iconColor}`} aria-hidden="true" />
          <div className="space-y-0.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-accent-orbitron text-[10px] font-bold uppercase tracking-wider text-[#EF3038]">
                {style.label}
              </span>
              <strong className="font-display-space text-xs sm:text-sm font-bold">
                {topNotice.title}
              </strong>
            </div>
            <p className="leading-relaxed opacity-90">{topNotice.body}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setDismissedIds((prev) => new Set(prev).add(topNotice.id))
          }
          aria-label="Dismiss announcement"
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
