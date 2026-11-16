import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CornerDownRight,
  Edit3,
  Flag,
  MessageSquare,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  createComment,
  deleteComment,
  subscribeToPostComments,
  updateComment,
} from '../../services/commentService';
import {
  COMMENT_MAX_LENGTH,
  validateCommentContent,
} from '../../services/validation';
import type {
  AtaComment,
  AtaPost,
  AuthViewMode,
  UpdatePostInput,
} from '../../types';
import { formatFullTimestamp, formatRelativeTimestamp } from '../../utils/time';
import { AtaLoadingSpinner } from '../AtaLoadingSpinner';
import { UserAvatar } from '../UserAvatar';
import { PostCard } from './PostCard';
import { SpoilerGate } from './SpoilerGate';

interface PostDetailModalProps {
  post: AtaPost | null;
  isLiked: boolean;
  blockedUserIds: Set<string>;
  onClose: () => void;
  onToggleLike: (post: AtaPost) => Promise<void>;
  onOpenAuthorProfile: (authorId: string) => void;
  onPostUpdated: (postId: string, updated: UpdatePostInput) => void;
  onPostDeleted: (postId: string) => void;
  onRequestReportPost: (post: AtaPost) => void;
  onRequestReportComment: (comment: AtaComment) => void;
  onBlockAuthor: (authorId: string, authorUsername: string) => Promise<void>;
  onCommentCountSync: (postId: string, totalCount: number) => void;
  onOpenAuth?: (mode: AuthViewMode) => void;
  communityId?: string;
  canModerate?: boolean;
  canComment?: boolean;
}

interface CommentNodeProps {
  comment: AtaComment;
  isReply?: boolean;
  currentUserId?: string;
  isVerified: boolean;
  canModerate?: boolean;
  canReply?: boolean;
  onOpenAuthorProfile: (authorId: string) => void;
  onReply: (comment: AtaComment) => void;
  onReportComment: (comment: AtaComment) => void;
  onBlockAuthor: (authorId: string, authorUsername: string) => Promise<void>;
  onEdited: (commentId: string, content: string, hasSpoiler: boolean) => Promise<void>;
  onDeleted: (commentId: string) => Promise<void>;
}

const CommentItem: React.FC<CommentNodeProps> = ({
  comment,
  isReply = false,
  currentUserId,
  isVerified,
  canModerate = false,
  canReply = true,
  onOpenAuthorProfile,
  onReply,
  onReportComment,
  onBlockAuthor,
  onEdited,
  onDeleted,
}) => {
  const isOwner = Boolean(currentUserId && currentUserId === comment.authorId);
  const canDelete = isOwner || canModerate;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [editSpoiler, setEditSpoiler] = useState(comment.hasSpoiler);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setItemError(null);

    const err = validateCommentContent(editText);
    if (err) {
      setItemError(err);
      return;
    }

    setIsSaving(true);
    try {
      await onEdited(comment.id, editText, editSpoiler);
      setIsEditing(false);
    } catch (saveErr) {
      setItemError(
        saveErr instanceof Error
          ? saveErr.message
          : 'Could not update comment.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setItemError(null);
    setIsDeleting(true);
    try {
      await onDeleted(comment.id);
    } catch (delErr) {
      setItemError(
        delErr instanceof Error ? delErr.message : 'Could not delete comment.'
      );
      setIsDeleting(false);
    }
  };

  const handleBlock = async () => {
    if (isBlocking) return;
    setItemError(null);
    setIsBlocking(true);
    try {
      await onBlockAuthor(comment.authorId, comment.authorUsername);
      setConfirmBlock(false);
    } catch (blockErr) {
      setItemError(
        blockErr instanceof Error
          ? blockErr.message
          : 'Could not block author.'
      );
      setIsBlocking(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8]/70 dark:bg-[#090B14]/80 p-3.5 space-y-2.5 ${
        isReply ? 'ml-5 sm:ml-8 border-l-2 border-l-[#EF3038]/60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpenAuthorProfile(comment.authorId)}
          className="flex items-center gap-2.5 text-left group min-w-0"
        >
          <UserAvatar
            displayName={comment.authorDisplayName}
            avatarUrl={comment.authorAvatarUrl}
            size="sm"
            className="h-7 w-7 text-[10px]"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
              <span className="font-display-space font-bold text-[#090B14] dark:text-white group-hover:text-[#EF3038] transition-colors truncate">
                {comment.authorDisplayName}
              </span>
              <span className="text-[#52576B] dark:text-[#A7A9B8] truncate">
                @{comment.authorUsername}
              </span>
              <span aria-hidden="true" className="text-[#A7A9B8]">
                ·
              </span>
              <time
                dateTime={comment.createdAt?.toISOString()}
                title={formatFullTimestamp(comment.createdAt)}
                className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]"
              >
                {formatRelativeTimestamp(comment.createdAt)}
              </time>
              {comment.isEdited && (
                <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                  · Edited
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {isOwner && isVerified && !isEditing && (
            <button
              type="button"
              onClick={() => {
                setEditText(comment.content);
                setEditSpoiler(comment.hasSpoiler);
                setIsEditing(true);
                setConfirmDelete(false);
              }}
              aria-label="Edit comment"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038]"
            >
              <Edit3 className="h-3 w-3" aria-hidden="true" />
            </button>
          )}

          {canDelete && isVerified && !isEditing && (
            <button
              type="button"
              onClick={() => setConfirmDelete((prev) => !prev)}
              aria-label={
                isOwner ? 'Delete comment' : 'Remove comment as moderator'
              }
              title={isOwner ? 'Delete comment' : 'Remove comment (Moderator)'}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038]"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </button>
          )}

          {!isOwner && isVerified && (
            <>
              <button
                type="button"
                onClick={() => onReportComment(comment)}
                aria-label={`Report comment by @${comment.authorUsername}`}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038]"
              >
                <Flag className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmBlock((prev) => !prev)}
                aria-label={`Block @${comment.authorUsername}`}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038]"
              >
                <Ban className="h-3 w-3" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {itemError && (
        <p className="text-xs text-[#B92335] dark:text-[#EF3038]">
          {itemError}
        </p>
      )}

      {confirmDelete && (
        <div className="rounded-lg bg-white dark:bg-[#171923] border border-[#EF3038] p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[#090B14] dark:text-white">
            Delete this comment?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1 rounded border border-[#D4D7E2] dark:border-[#303342]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="px-2.5 py-1 rounded bg-[#EF3038] text-white font-semibold"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {confirmBlock && (
        <div className="rounded-lg bg-white dark:bg-[#171923] border border-[#EF3038] p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[#090B14] dark:text-white">
            Block @{comment.authorUsername}?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmBlock(false)}
              className="px-2.5 py-1 rounded border border-[#D4D7E2] dark:border-[#303342]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isBlocking}
              onClick={handleBlock}
              className="px-2.5 py-1 rounded bg-[#EF3038] text-white font-semibold"
            >
              {isBlocking ? 'Blocking...' : 'Block'}
            </button>
          </div>
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="space-y-2">
          <textarea
            rows={2}
            disabled={isSaving}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full rounded-lg bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-2.5 text-xs sm:text-sm text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-[#090B14] dark:text-white cursor-pointer">
              <input
                type="checkbox"
                checked={editSpoiler}
                onChange={(e) => setEditSpoiler(e.target.checked)}
                className="accent-[#EF3038]"
              />
              <span>Mark spoiler</span>
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#EF3038] text-white"
              >
                <Save className="h-3 w-3" aria-hidden="true" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        <SpoilerGate hasSpoiler={comment.hasSpoiler} compact>
          <p className="text-xs sm:text-sm leading-relaxed text-[#090B14] dark:text-white/95 whitespace-pre-wrap break-words">
            {comment.replyToAuthorUsername && (
              <span className="font-semibold text-[#B92335] dark:text-[#EF3038] mr-1.5">
                @{comment.replyToAuthorUsername}
              </span>
            )}
            {comment.content}
          </p>
        </SpoilerGate>
      )}

      {isVerified && canReply && !isEditing && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038] transition-colors"
          >
            <CornerDownRight className="h-3 w-3" aria-hidden="true" />
            <span>Reply</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  isLiked,
  blockedUserIds,
  onClose,
  onToggleLike,
  onOpenAuthorProfile,
  onPostUpdated,
  onPostDeleted,
  onRequestReportPost,
  onRequestReportComment,
  onBlockAuthor,
  onCommentCountSync,
  onOpenAuth,
  communityId,
  canModerate = false,
  canComment = true,
}) => {
  const { firebaseUser, profile } = useAuth();

  const [comments, setComments] = useState<AtaComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState('');
  const [newCommentSpoiler, setNewCommentSpoiler] = useState(false);
  const [replyTarget, setReplyTarget] = useState<AtaComment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!post) return;
    setIsLoadingComments(true);
    setCommentsError(null);
    setReplyTarget(null);
    setNewComment('');
    setNewCommentSpoiler(false);
    setSubmitError(null);

    const unsubscribe = subscribeToPostComments(
      post.id,
      (loaded) => {
        setComments(loaded);
        setIsLoadingComments(false);
        onCommentCountSync(post.id, loaded.length);
      },
      (errMessage) => {
        setCommentsError(errMessage);
        setIsLoadingComments(false);
      },
      communityId
    );

    return () => {
      unsubscribe();
    };
  }, [post?.id, communityId]);

  const visibleComments = useMemo(() => {
    return comments.filter((c) => !blockedUserIds.has(c.authorId));
  }, [comments, blockedUserIds]);

  const { topLevelComments, repliesByParent } = useMemo(() => {
    const visibleIds = new Set(visibleComments.map((c) => c.id));
    const top: AtaComment[] = [];
    const byParent = new Map<string, AtaComment[]>();

    for (const c of visibleComments) {
      if (!c.parentCommentId || !visibleIds.has(c.parentCommentId)) {
        top.push(c);
      } else {
        const list = byParent.get(c.parentCommentId) || [];
        list.push(c);
        byParent.set(c.parentCommentId, list);
      }
    }

    return { topLevelComments: top, repliesByParent: byParent };
  }, [visibleComments]);

  if (!post) return null;

  const isVerified = Boolean(firebaseUser?.emailVerified);

  const handleReply = (comment: AtaComment) => {
    // Keep nesting clean at 2 visual levels: reply to top-level parent if replying to a reply
    const rootParentId = comment.parentCommentId || comment.id;
    setReplyTarget({
      ...comment,
      id: rootParentId,
      authorUsername: comment.authorUsername,
    });
    setSubmitError(null);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !profile) return;

    setSubmitError(null);
    const err = validateCommentContent(newComment);
    if (err) {
      setSubmitError(err);
      return;
    }

    setIsSubmitting(true);
    try {
      await createComment(
        post.id,
        profile,
        {
          content: newComment,
          parentCommentId: replyTarget?.id || '',
          replyToAuthorUsername: replyTarget?.authorUsername || '',
          hasSpoiler: newCommentSpoiler,
        },
        communityId
      );
      setNewComment('');
      setNewCommentSpoiler(false);
      setReplyTarget(null);
    } catch (createErr) {
      setSubmitError(
        createErr instanceof Error
          ? createErr.message
          : 'Unable to publish comment right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ata-post-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="bg-[#090B14] px-5 py-4 border-b border-[#303342] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare
              className="h-4 w-4 text-[#EF3038]"
              aria-hidden="true"
            />
            <h2
              id="ata-post-detail-title"
              className="font-display-space font-bold text-base sm:text-lg text-white"
            >
              Post Thread
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close post thread"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#303342] bg-[#171923] text-white hover:border-[#EF3038] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          <PostCard
            post={post}
            isLiked={isLiked}
            onToggleLike={onToggleLike}
            onOpenDetail={() => {}}
            onOpenAuthorProfile={(uid) => {
              onClose();
              onOpenAuthorProfile(uid);
            }}
            onPostUpdated={onPostUpdated}
            onPostDeleted={(deletedId) => {
              onPostDeleted(deletedId);
              onClose();
            }}
            onRequestReport={onRequestReportPost}
            onBlockAuthor={onBlockAuthor}
            onOpenAuth={onOpenAuth}
            showDetailButton={false}
            communityId={communityId}
            canModerate={canModerate}
          />

          {/* Comment Composer */}
          <section aria-label="Write a comment" className="space-y-3">
            {!firebaseUser ? (
              <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                  Sign in with an ATA account to join the discussion and reply
                  to comments.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth?.('login');
                  }}
                  className="px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335]"
                >
                  Sign In
                </button>
              </div>
            ) : !isVerified ? (
              <p className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038] p-3.5 text-xs text-[#090B14] dark:text-white">
                Verify your email address on your Profile page to post comments
                or replies.
              </p>
            ) : !canComment ? (
              <p className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Join this community to post comments and replies in its
                discussions.
              </p>
            ) : (
              <form
                onSubmit={handleSubmitComment}
                className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 space-y-3"
              >
                {replyTarget && (
                  <div className="flex items-center justify-between gap-2 text-xs text-[#090B14] dark:text-white border-b border-[#D4D7E2] dark:border-[#303342] pb-2">
                    <span>
                      Replying to{' '}
                      <strong className="text-[#EF3038]">
                        @{replyTarget.authorUsername}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyTarget(null)}
                      className="text-[11px] font-semibold text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038]"
                    >
                      Cancel Reply
                    </button>
                  </div>
                )}

                {submitError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg bg-[#EF3038]/10 border border-[#EF3038] p-2.5 text-xs text-[#090B14] dark:text-white"
                  >
                    <AlertCircle
                      className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{submitError}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="ata-new-comment" className="sr-only">
                    Write a comment
                  </label>
                  <textarea
                    id="ata-new-comment"
                    rows={2}
                    maxLength={COMMENT_MAX_LENGTH + 50}
                    disabled={isSubmitting || !profile}
                    value={newComment}
                    onChange={(e) => {
                      setNewComment(e.target.value);
                      if (submitError) setSubmitError(null);
                    }}
                    placeholder={
                      replyTarget
                        ? `Write a reply to @${replyTarget.authorUsername}...`
                        : 'Add your thoughts to this discussion...'
                    }
                    className="w-full resize-y rounded-xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-3 text-xs sm:text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-xs text-[#090B14] dark:text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCommentSpoiler}
                        disabled={isSubmitting}
                        onChange={(e) => setNewCommentSpoiler(e.target.checked)}
                        className="accent-[#EF3038]"
                      />
                      <span>Mark Spoiler</span>
                    </label>
                    <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                      {newComment.trim().length}/{COMMENT_MAX_LENGTH}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      isSubmitting || !profile || newComment.trim().length === 0
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {isSubmitting
                        ? 'Posting...'
                        : replyTarget
                          ? 'Post Reply'
                          : 'Post Comment'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Comments List */}
          <section aria-label="Comments thread" className="space-y-3">
            <h3 className="font-display-space font-bold text-sm uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8]">
              Comments ({visibleComments.length})
            </h3>

            {isLoadingComments ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                <AtaLoadingSpinner size="sm" label="Loading comments" />
                <span>Loading comments...</span>
              </div>
            ) : commentsError ? (
              <div
                role="alert"
                className="rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
              >
                {commentsError}
              </div>
            ) : topLevelComments.length === 0 ? (
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] py-4 text-center rounded-xl border border-dashed border-[#D4D7E2] dark:border-[#303342]">
                No comments yet. Be the first to share a perspective!
              </p>
            ) : (
              <div className="space-y-3">
                {topLevelComments.map((comment) => {
                  const replies = repliesByParent.get(comment.id) || [];
                  return (
                    <div key={comment.id} className="space-y-2">
                      <CommentItem
                        comment={comment}
                        currentUserId={firebaseUser?.uid}
                        isVerified={isVerified}
                        canModerate={canModerate}
                        canReply={canComment}
                        onOpenAuthorProfile={(uid) => {
                          onClose();
                          onOpenAuthorProfile(uid);
                        }}
                        onReply={handleReply}
                        onReportComment={onRequestReportComment}
                        onBlockAuthor={onBlockAuthor}
                        onEdited={(cid, content, spoiler) =>
                          updateComment(post.id, cid, content, spoiler, communityId)
                        }
                        onDeleted={(cid) =>
                          deleteComment(post.id, cid, communityId)
                        }
                      />

                      {replies.map((reply) => (
                        <CommentItem
                          key={reply.id}
                          comment={reply}
                          isReply
                          currentUserId={firebaseUser?.uid}
                          isVerified={isVerified}
                          canModerate={canModerate}
                          canReply={canComment}
                          onOpenAuthorProfile={(uid) => {
                            onClose();
                            onOpenAuthorProfile(uid);
                          }}
                          onReply={handleReply}
                          onReportComment={onRequestReportComment}
                          onBlockAuthor={onBlockAuthor}
                          onEdited={(cid, content, spoiler) =>
                            updateComment(
                              post.id,
                              cid,
                              content,
                              spoiler,
                              communityId
                            )
                          }
                          onDeleted={(cid) =>
                            deleteComment(post.id, cid, communityId)
                          }
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
