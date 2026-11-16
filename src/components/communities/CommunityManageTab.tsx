import React, { useState } from 'react';
import {
  AlertCircle,
  Archive,
  Check,
  Edit3,
  Globe,
  Lock,
  RotateCcw,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import type { AtaCommunity, CommunityJoinRequest } from '../../types';
import { formatRelativeTimestamp } from '../../utils/time';
import { AtaLoadingSpinner } from '../AtaLoadingSpinner';
import { UserAvatar } from '../UserAvatar';

interface CommunityManageTabProps {
  community: AtaCommunity;
  isOwner: boolean;
  pendingRequests: CommunityJoinRequest[];
  isLoadingRequests: boolean;
  requestsError: string | null;
  onEditDetails: () => void;
  onApproveRequest: (request: CommunityJoinRequest) => Promise<void>;
  onRejectRequest: (request: CommunityJoinRequest) => Promise<void>;
  onOpenProfile: (uid: string) => void;
  onUpdateOwnerSettings: (settings: {
    visibility: 'public' | 'private';
    status: 'active' | 'archived';
  }) => Promise<void>;
  onDeleteCommunity: () => Promise<void>;
}

export const CommunityManageTab: React.FC<CommunityManageTabProps> = ({
  community,
  isOwner,
  pendingRequests,
  isLoadingRequests,
  requestsError,
  onEditDetails,
  onApproveRequest,
  onRejectRequest,
  onOpenProfile,
  onUpdateOwnerSettings,
  onDeleteCommunity,
}) => {
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [busyOwnerAction, setBusyOwnerAction] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteSlugInput, setDeleteSlugInput] = useState('');
  const [manageError, setManageError] = useState<string | null>(null);

  const handleRequestAction = async (
    request: CommunityJoinRequest,
    action: 'approve' | 'reject'
  ) => {
    if (busyRequestId) return;
    setManageError(null);
    setBusyRequestId(request.userId);
    try {
      if (action === 'approve') {
        await onApproveRequest(request);
      } else {
        await onRejectRequest(request);
      }
    } catch (err) {
      setManageError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} membership request.`
      );
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleToggleVisibility = async () => {
    if (!isOwner || busyOwnerAction) return;
    setManageError(null);
    setBusyOwnerAction(true);
    try {
      await onUpdateOwnerSettings({
        visibility: community.visibility === 'public' ? 'private' : 'public',
        status: community.status,
      });
    } catch (err) {
      setManageError(
        err instanceof Error
          ? err.message
          : 'Unable to update community visibility.'
      );
    } finally {
      setBusyOwnerAction(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!isOwner || busyOwnerAction) return;
    setManageError(null);
    setBusyOwnerAction(true);
    try {
      await onUpdateOwnerSettings({
        visibility: community.visibility,
        status: community.status === 'active' ? 'archived' : 'active',
      });
    } catch (err) {
      setManageError(
        err instanceof Error
          ? err.message
          : 'Unable to update community archive state.'
      );
    } finally {
      setBusyOwnerAction(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!isOwner || busyOwnerAction) return;
    if (deleteSlugInput.trim().toLowerCase() !== community.slug) {
      setManageError(`Type "${community.slug}" to confirm permanent deletion.`);
      return;
    }
    setManageError(null);
    setBusyOwnerAction(true);
    try {
      await onDeleteCommunity();
    } catch (err) {
      setManageError(
        err instanceof Error ? err.message : 'Unable to delete community.'
      );
      setBusyOwnerAction(false);
    }
  };

  return (
    <div className="space-y-5">
      {manageError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3.5 text-xs text-[#090B14] dark:text-white"
        >
          <AlertCircle
            className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{manageError}</span>
        </div>
      )}

      {/* Moderator & Owner Profile Controls */}
      <section className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
            Community Details &amp; Guidelines
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
            Update club description, category, anime tags, artwork, and member
            discussion rules.
          </p>
        </div>
        <button
          type="button"
          onClick={onEditDetails}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors whitespace-nowrap shrink-0"
        >
          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Edit Community Details</span>
        </button>
      </section>

      {/* Membership Requests Queue */}
      <section className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-3">
          <div>
            <h3 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
              Membership Requests
            </h3>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Review incoming membership requests for private club access.
            </p>
          </div>
          <span className="font-display-space font-bold text-sm text-[#EF3038] tabular-nums">
            {pendingRequests.length} Pending
          </span>
        </div>

        {isLoadingRequests ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#52576B] dark:text-[#A7A9B8]">
            <AtaLoadingSpinner size="sm" label="Loading membership requests" />
            <span>Loading pending requests...</span>
          </div>
        ) : requestsError ? (
          <p className="text-xs text-[#B92335] dark:text-[#EF3038]">
            {requestsError}
          </p>
        ) : pendingRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D4D7E2] dark:border-[#303342] p-5 text-center space-y-1.5">
            <UserCheck
              className="h-5 w-5 text-[#52576B] dark:text-[#A7A9B8] mx-auto"
              aria-hidden="true"
            />
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              No pending membership requests right now.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#D4D7E2]/70 dark:divide-[#303342]">
            {pendingRequests.map((req) => {
              const isBusy = busyRequestId === req.userId;
              return (
                <div
                  key={req.id}
                  className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(req.userId)}
                      className="flex items-center gap-2.5 text-left group"
                    >
                      <UserAvatar
                        displayName={req.displayName}
                        avatarUrl={req.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white group-hover:text-[#EF3038] truncate">
                          {req.displayName}
                        </p>
                        <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] truncate">
                          @{req.username} · Requested{' '}
                          {formatRelativeTimestamp(req.createdAt)}
                        </p>
                      </div>
                    </button>
                    {req.message && (
                      <p className="text-xs text-[#090B14] dark:text-white/90 bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl p-2.5">
                        &ldquo;{req.message}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleRequestAction(req, 'reject')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleRequestAction(req, 'approve')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isBusy ? 'Saving...' : 'Approve'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Owner-Only Governance Controls */}
      {isOwner && (
        <section className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5 space-y-4">
          <div className="border-b border-[#D4D7E2] dark:border-[#303342] pb-3">
            <h3 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
              Owner Controls
            </h3>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Manage visibility, archive status, or permanent removal of this
              community.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 flex flex-col justify-between gap-3">
              <div>
                <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white flex items-center gap-1.5">
                  {community.visibility === 'public' ? (
                    <Globe className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                  ) : (
                    <Lock className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                  )}
                  <span>
                    Visibility:{' '}
                    {community.visibility === 'public' ? 'Public' : 'Private'}
                  </span>
                </p>
                <p className="mt-1 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                  {community.visibility === 'public'
                    ? 'Anyone on ATA can browse discussions and join immediately.'
                    : 'Only approved members can view discussions or member lists.'}
                </p>
              </div>
              <button
                type="button"
                disabled={busyOwnerAction}
                onClick={() => void handleToggleVisibility()}
                className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] disabled:opacity-50"
              >
                {community.visibility === 'public'
                  ? 'Switch to Private'
                  : 'Switch to Public'}
              </button>
            </div>

            <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 flex flex-col justify-between gap-3">
              <div>
                <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white flex items-center gap-1.5">
                  {community.status === 'active' ? (
                    <Archive
                      className="h-4 w-4 text-[#EF3038]"
                      aria-hidden="true"
                    />
                  ) : (
                    <RotateCcw
                      className="h-4 w-4 text-[#EF3038]"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    Status:{' '}
                    {community.status === 'active' ? 'Active' : 'Archived'}
                  </span>
                </p>
                <p className="mt-1 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                  {community.status === 'active'
                    ? 'Archiving hides the club from public discovery and pauses new posts.'
                    : 'Restore this club to active status so members can post again.'}
                </p>
              </div>
              <button
                type="button"
                disabled={busyOwnerAction}
                onClick={() => void handleToggleArchive()}
                className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] disabled:opacity-50"
              >
                {community.status === 'active'
                  ? 'Archive Community'
                  : 'Restore Community'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#EF3038]/60 bg-[#EF3038]/5 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white">
                  Delete Community Permanently
                </p>
                <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                  Removes the community record, frees the URL slug, and cannot
                  be undone. Consider archiving instead to preserve history.
                </p>
              </div>
              {!confirmDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Delete Community</span>
                </button>
              )}
            </div>

            {confirmDelete && (
              <div className="pt-2 border-t border-[#EF3038]/30 space-y-3">
                <label
                  htmlFor="ata-confirm-delete-slug"
                  className="block text-xs font-semibold text-[#090B14] dark:text-white"
                >
                  Type <code className="text-[#EF3038]">{community.slug}</code>{' '}
                  to confirm deletion:
                </label>
                <input
                  id="ata-confirm-delete-slug"
                  type="text"
                  value={deleteSlugInput}
                  onChange={(e) => setDeleteSlugInput(e.target.value)}
                  placeholder={community.slug}
                  className="w-full rounded-xl bg-white dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 min-h-[40px] text-xs sm:text-sm text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={busyOwnerAction}
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeleteSlugInput('');
                    }}
                    className="px-3.5 py-2 min-h-[38px] text-xs font-semibold rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] text-[#090B14] dark:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      busyOwnerAction ||
                      deleteSlugInput.trim().toLowerCase() !== community.slug
                    }
                    onClick={() => void handlePermanentDelete()}
                    className="px-4 py-2 min-h-[38px] text-xs font-semibold rounded-xl bg-[#EF3038] text-white border border-[#B92335] hover:bg-[#B92335] disabled:opacity-50"
                  >
                    {busyOwnerAction
                      ? 'Deleting...'
                      : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
