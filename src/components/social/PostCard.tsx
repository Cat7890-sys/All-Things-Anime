import React, { useState } from 'react';
import {
  AlertCircle,
  Ban,
  Edit3,
  Film,
  Flag,
  Heart,
  MessageSquare,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { deletePost, updatePost } from '../../services/postService';
import {
  ANIME_TITLE_MAX_LENGTH,
  POST_MAX_LENGTH,
  SPOILER_LABEL_MAX_LENGTH,
  validatePostForm,
} from '../../services/validation';
import type { AtaPost, AuthViewMode, UpdatePostInput } from '../../types';
import { formatFullTimestamp, formatRelativeTimestamp } from '../../utils/time';
import { UserAvatar } from '../UserAvatar';
import { SpoilerGate } from './SpoilerGate';

interface PostCardProps {
  post: AtaPost;
  isLiked: boolean;
  onToggleLike: (post: AtaPost) => Promise<void>;
  onOpenDetail: (post: AtaPost) => void;
  onOpenAuthorProfile: (authorId: string) => void;
  onPostUpdated: (postId: string, updated: UpdatePostInput) => void;
  onPostDeleted: (postId: string) => void;
  onRequestReport: (post: AtaPost) => void;
  onBlockAuthor: (authorId: string, authorUsername: string) => Promise<void>;
  onOpenAuth?: (mode: AuthViewMode) => void;
  showDetailButton?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  isLiked,
  onToggleLike,
  onOpenDetail,
  onOpenAuthorProfile,
  onPostUpdated,
  onPostDeleted,
  onRequestReport,
  onBlockAuthor,
  onOpenAuth,
  showDetailButton = true,
}) => {
  const { firebaseUser } = useAuth();
  const isOwner = Boolean(firebaseUser && firebaseUser.uid === post.authorId);
  const isVerifiedSignedIn = Boolean(firebaseUser?.emailVerified);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editAnimeTitle, setEditAnimeTitle] = useState(post.animeTitle);
  const [editHasSpoiler, setEditHasSpoiler] = useState(post.hasSpoiler);
  const [editSpoilerLabel, setEditSpoilerLabel] = useState(post.spoilerLabel);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [confirmBlock, setConfirmBlock] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const [isLiking, setIsLiking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleLikeClick = async () => {
    setActionError(null);
    if (!firebaseUser) {
      onOpenAuth?.('login');
      return;
    }
    if (!firebaseUser.emailVerified) {
      setActionError('Please verify your email address before liking posts.');
      return;
    }
    if (isLiking) return;

    setIsLiking(true);
    try {
      await onToggleLike(post);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not update reaction.'
      );
    } finally {
      setIsLiking(false);
    }
  };

  const handleStartEdit = () => {
    setActionError(null);
    setEditContent(post.content);
    setEditAnimeTitle(post.animeTitle);
    setEditHasSpoiler(post.hasSpoiler);
    setEditSpoilerLabel(post.spoilerLabel);
    setIsEditing(true);
    setConfirmDelete(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingEdit) return;
    setActionError(null);

    const payload: UpdatePostInput = {
      content: editContent,
      animeTitle: editAnimeTitle,
      hasSpoiler: editHasSpoiler,
      spoilerLabel: editSpoilerLabel,
    };

    const validationError = validatePostForm(payload);
    if (validationError) {
      setActionError(validationError);
      return;
    }

    setIsSavingEdit(true);
    try {
      await updatePost(post.id, payload);
      onPostUpdated(post.id, payload);
      setIsEditing(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to save post edits.'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (isDeleting) return;
    setActionError(null);
    setIsDeleting(true);
    try {
      await deletePost(post.id, post.imagePath);
      onPostDeleted(post.id);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to delete post.'
      );
      setIsDeleting(false);
    }
  };

  const handleBlockConfirm = async () => {
    if (isBlocking) return;
    setActionError(null);
    setIsBlocking(true);
    try {
      await onBlockAuthor(post.authorId, post.authorUsername);
      setConfirmBlock(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to block user.'
      );
      setIsBlocking(false);
    }
  };

  return (
    <article className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5 transition-colors duration-150 hover:border-[#EF3038]/55">
      {/* Author & Metadata Header */}
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpenAuthorProfile(post.authorId)}
          className="flex items-center gap-3 text-left group min-w-0"
        >
          <UserAvatar
            displayName={post.authorDisplayName}
            avatarUrl={post.authorAvatarUrl}
            size="sm"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="font-display-space font-bold text-sm sm:text-base text-[#090B14] dark:text-white group-hover:text-[#EF3038] transition-colors truncate">
                {post.authorDisplayName}
              </span>
              <span className="text-xs text-[#52576B] dark:text-[#A7A9B8] truncate">
                @{post.authorUsername}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              <time
                dateTime={post.createdAt?.toISOString()}
                title={formatFullTimestamp(post.createdAt)}
              >
                {formatRelativeTimestamp(post.createdAt)}
              </time>
              {post.isEdited && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Edited</span>
                </>
              )}
              {post.animeTitle && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#B92335] dark:text-[#EF3038]">
                    <Film className="h-3 w-3" aria-hidden="true" />
                    <span>{post.animeTitle}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </button>

        {/* Owner or Safety Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isOwner && isVerifiedSignedIn && !isEditing && (
            <>
              <button
                type="button"
                onClick={handleStartEdit}
                aria-label="Edit post"
                title="Edit post"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038] transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete((prev) => !prev);
                  setActionError(null);
                }}
                aria-label="Delete post"
                title="Delete post"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038] transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}

          {!isOwner && isVerifiedSignedIn && (
            <>
              <button
                type="button"
                onClick={() => onRequestReport(post)}
                aria-label={`Report post by @${post.authorUsername}`}
                title="Report post"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038] transition-colors"
              >
                <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmBlock((prev) => !prev);
                  setActionError(null);
                }}
                aria-label={`Block @${post.authorUsername}`}
                title={`Block @${post.authorUsername}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038] transition-colors"
              >
                <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
        >
          <AlertCircle
            className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{actionError}</span>
        </div>
      )}

      {confirmDelete && (
        <div className="mt-3 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038] p-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-[#090B14] dark:text-white">
            Permanently delete this post? This cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 min-h-[36px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
              className="px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-lg hover:bg-[#B92335] disabled:opacity-60"
            >
              {isDeleting ? 'Deleting...' : 'Delete Post'}
            </button>
          </div>
        </div>
      )}

      {confirmBlock && (
        <div className="mt-3 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038] p-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-[#090B14] dark:text-white">
            Block @{post.authorUsername}? Their posts and comments will be hidden
            from your feed.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBlocking}
              onClick={() => setConfirmBlock(false)}
              className="px-3 py-1.5 min-h-[36px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isBlocking}
              onClick={handleBlockConfirm}
              className="px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-lg hover:bg-[#B92335] disabled:opacity-60"
            >
              {isBlocking ? 'Blocking...' : 'Confirm Block'}
            </button>
          </div>
        </div>
      )}

      {/* Body or Inline Editor */}
      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor={`edit-content-${post.id}`}
                className="text-xs font-semibold text-[#090B14] dark:text-white"
              >
                Edit Post Content
              </label>
              <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                {editContent.trim().length}/{POST_MAX_LENGTH}
              </span>
            </div>
            <textarea
              id={`edit-content-${post.id}`}
              rows={3}
              disabled={isSavingEdit}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full resize-y rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3 text-sm text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              maxLength={ANIME_TITLE_MAX_LENGTH}
              disabled={isSavingEdit}
              value={editAnimeTitle}
              onChange={(e) => setEditAnimeTitle(e.target.value)}
              placeholder="Anime title (optional)"
              aria-label="Edit anime association"
              className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 min-h-[40px] text-xs text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
            />
            <label className="inline-flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] cursor-pointer">
              <input
                type="checkbox"
                checked={editHasSpoiler}
                disabled={isSavingEdit}
                onChange={(e) => setEditHasSpoiler(e.target.checked)}
                className="h-4 w-4 accent-[#EF3038]"
              />
              <span className="text-xs font-semibold text-[#090B14] dark:text-white">
                Mark as Spoiler
              </span>
            </label>
          </div>

          {editHasSpoiler && (
            <input
              type="text"
              maxLength={SPOILER_LABEL_MAX_LENGTH}
              disabled={isSavingEdit}
              value={editSpoilerLabel}
              onChange={(e) => setEditSpoilerLabel(e.target.value)}
              placeholder="Spoiler label (optional)"
              aria-label="Edit spoiler context label"
              className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038]/60 px-3 py-2 min-h-[40px] text-xs text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
            />
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isSavingEdit}
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cancel</span>
            </button>
            <button
              type="submit"
              disabled={isSavingEdit}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isSavingEdit ? 'Saving...' : 'Save Edit'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3.5">
          <SpoilerGate
            hasSpoiler={post.hasSpoiler}
            spoilerLabel={post.spoilerLabel}
          >
            <div className="space-y-3">
              <p className="text-sm sm:text-[15px] leading-relaxed text-[#090B14] dark:text-white/95 whitespace-pre-wrap break-words">
                {post.content}
              </p>

              {post.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-[#D4D7E2] dark:border-[#303342] bg-[#090B14]">
                  <img
                    src={post.imageUrl}
                    alt={
                      post.animeTitle
                        ? `${post.animeTitle} post attachment by @${post.authorUsername}`
                        : `Image posted by @${post.authorUsername}`
                    }
                    loading="lazy"
                    className="w-full max-h-[440px] object-contain mx-auto"
                  />
                </div>
              )}
            </div>
          </SpoilerGate>
        </div>
      )}

      {/* Engagement Footer */}
      <div className="mt-4 pt-3.5 border-t border-[#D4D7E2]/70 dark:border-[#303342] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isLiking}
            onClick={handleLikeClick}
            aria-pressed={isLiked}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[38px] text-xs font-semibold rounded-xl border transition-colors duration-150 tabular-nums ${
              isLiked
                ? 'bg-[#EF3038]/12 border-[#EF3038] text-[#B92335] dark:text-[#EF3038]'
                : 'bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#090B14] dark:hover:text-white'
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 ${
                isLiked ? 'fill-[#EF3038] text-[#EF3038]' : ''
              }`}
              aria-hidden="true"
            />
            <span>{post.likeCount}</span>
            <span className="sr-only">likes</span>
          </button>

          {showDetailButton ? (
            <button
              type="button"
              onClick={() => onOpenDetail(post)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[38px] text-xs font-semibold rounded-xl border bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#090B14] dark:hover:text-white transition-colors duration-150 tabular-nums"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{post.commentCount}</span>
              <span>{post.commentCount === 1 ? 'Comment' : 'Comments'}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {post.commentCount}{' '}
                {post.commentCount === 1 ? 'Comment' : 'Comments'}
              </span>
            </span>
          )}
        </div>

        {showDetailButton && (
          <button
            type="button"
            onClick={() => onOpenDetail(post)}
            className="text-xs font-semibold text-[#B92335] dark:text-[#EF3038] hover:underline"
          >
            Open Thread
          </button>
        )}
      </div>
    </article>
  );
};
