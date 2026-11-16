import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Film,
  ImagePlus,
  LogIn,
  MessageSquarePlus,
  Send,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isStorageConfigured } from '../../services/firebase';
import { createPost } from '../../services/postService';
import {
  ANIME_TITLE_MAX_LENGTH,
  POST_MAX_LENGTH,
  SPOILER_LABEL_MAX_LENGTH,
  validatePostForm,
  validatePostImageFile,
} from '../../services/validation';
import type { AtaPost, AuthViewMode } from '../../types';
import { UserAvatar } from '../UserAvatar';

interface PostComposerProps {
  onPostCreated: (post: AtaPost) => void;
  onOpenAuth?: (mode: AuthViewMode) => void;
  onNavigateProfile?: () => void;
}

export const PostComposer: React.FC<PostComposerProps> = ({
  onPostCreated,
  onOpenAuth,
  onNavigateProfile,
}) => {
  const { firebaseUser, profile, isLoadingAuth } = useAuth();

  const [content, setContent] = useState('');
  const [animeTitle, setAnimeTitle] = useState('');
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [spoilerLabel, setSpoilerLabel] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const clearImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0] || null;
    if (!selected) {
      clearImage();
      return;
    }

    const fileErr = validatePostImageFile(selected);
    if (fileErr) {
      setError(fileErr);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(selected);
    setImagePreviewUrl(URL.createObjectURL(selected));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !profile) return;

    setError(null);
    const formError = validatePostForm({
      content,
      animeTitle,
      hasSpoiler,
      spoilerLabel,
      imageFile,
    });
    if (formError) {
      setError(formError);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createPost(profile, {
        content,
        animeTitle,
        hasSpoiler,
        spoilerLabel,
        imageFile,
      });

      setContent('');
      setAnimeTitle('');
      setHasSpoiler(false);
      setSpoilerLabel('');
      clearImage();
      onPostCreated(created);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to publish post right now. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <section
        aria-label="Loading post composer"
        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-6"
      >
        <div className="h-20 animate-pulse rounded-xl bg-[#F4F5F8] dark:bg-[#090B14]" />
      </section>
    );
  }

  if (!firebaseUser) {
    return (
      <section
        aria-labelledby="composer-signin-heading"
        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5 sm:p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <MessageSquarePlus
              className="h-5 w-5 text-[#EF3038] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <h2
                id="composer-signin-heading"
                className="font-display-space font-bold text-lg sm:text-xl text-[#090B14] dark:text-white"
              >
                Join the ATA Conversation
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
                Sign in with an ATA account to publish opinions, react to
                posts, comment, and follow creators.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth?.('login')}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors whitespace-nowrap"
            >
              <LogIn className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth?.('register')}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors whitespace-nowrap"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Create Account</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!firebaseUser.emailVerified) {
    return (
      <section
        aria-labelledby="composer-verify-heading"
        className="bg-white dark:bg-[#171923] border border-[#EF3038] rounded-2xl p-5 sm:p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="h-5 w-5 text-[#EF3038] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <h2
                id="composer-verify-heading"
                className="font-display-space font-bold text-lg text-[#090B14] dark:text-white"
              >
                Verify Your Email to Publish
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
                Publishing posts, commenting, reacting, and following unlock as
                soon as you verify{' '}
                <span className="font-semibold text-[#090B14] dark:text-white">
                  {firebaseUser.email}
                </span>
                .
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateProfile}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors whitespace-nowrap shrink-0"
          >
            <span>Open Verification</span>
          </button>
        </div>
      </section>
    );
  }

  const trimmedLength = content.trim().length;

  return (
    <section
      aria-labelledby="ata-post-composer-heading"
      className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar
            displayName={
              profile?.displayName || firebaseUser.displayName || 'ATA Member'
            }
            avatarUrl={profile?.avatarUrl}
            size="sm"
          />
          <div className="min-w-0">
            <h2
              id="ata-post-composer-heading"
              className="font-display-space font-bold text-lg sm:text-xl text-[#090B14] dark:text-white truncate"
            >
              Share an Anime Take
            </h2>
            {profile && (
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] truncate">
                Posting as @{profile.username}
              </p>
            )}
          </div>
        </div>

        <span className="text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8] tabular-nums shrink-0">
          {trimmedLength}/{POST_MAX_LENGTH}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
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

        <div>
          <label htmlFor="ata-post-content" className="sr-only">
            Write your post
          </label>
          <textarea
            id="ata-post-content"
            rows={3}
            maxLength={POST_MAX_LENGTH + 100}
            disabled={isSubmitting || !profile}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Share a scene breakdown, series recommendation, or respectful episode reaction..."
            className="w-full resize-y rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="ata-post-anime-title"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#090B14] dark:text-white mb-1"
            >
              <Film className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>Anime Association (Optional)</span>
            </label>
            <input
              id="ata-post-anime-title"
              type="text"
              maxLength={ANIME_TITLE_MAX_LENGTH}
              disabled={isSubmitting || !profile}
              value={animeTitle}
              onChange={(e) => setAnimeTitle(e.target.value)}
              placeholder="e.g., Frieren, Vinland Saga, Mob Psycho 100"
              className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 min-h-[42px] text-xs sm:text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none"
            />
          </div>

          <div className="flex flex-col justify-end">
            <label className="inline-flex items-center gap-2.5 min-h-[42px] px-3 py-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] cursor-pointer">
              <input
                type="checkbox"
                checked={hasSpoiler}
                disabled={isSubmitting || !profile}
                onChange={(e) => setHasSpoiler(e.target.checked)}
                className="h-4 w-4 accent-[#EF3038]"
              />
              <span className="text-xs font-semibold text-[#090B14] dark:text-white">
                Mark Post as Spoiler
              </span>
            </label>
          </div>
        </div>

        {hasSpoiler && (
          <div>
            <label
              htmlFor="ata-post-spoiler-label"
              className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
            >
              Spoiler Context Label (Optional — visible before reveal)
            </label>
            <input
              id="ata-post-spoiler-label"
              type="text"
              maxLength={SPOILER_LABEL_MAX_LENGTH}
              disabled={isSubmitting || !profile}
              value={spoilerLabel}
              onChange={(e) => setSpoilerLabel(e.target.value)}
              placeholder="e.g., Season 2 Finale, Manga Ch. 142"
              className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038]/60 px-3 py-2 min-h-[42px] text-xs sm:text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none"
            />
          </div>
        )}

        {imagePreviewUrl && (
          <div className="relative rounded-xl overflow-hidden border border-[#D4D7E2] dark:border-[#303342] bg-[#090B14] max-h-72">
            <img
              src={imagePreviewUrl}
              alt="Selected post upload preview"
              className="w-full max-h-72 object-contain mx-auto"
            />
            <button
              type="button"
              onClick={clearImage}
              aria-label="Remove attached image"
              className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#090B14]/90 border border-[#303342] text-xs font-semibold text-white hover:border-[#EF3038] transition-colors"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Remove</span>
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              id="ata-post-image-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={isSubmitting || !profile || !isStorageConfigured}
              onChange={handleImageSelect}
              className="sr-only"
            />
            <label
              htmlFor="ata-post-image-input"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
                isStorageConfigured
                  ? 'cursor-pointer text-[#090B14] dark:text-[#A7A9B8] bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] hover:text-[#090B14] dark:hover:text-white'
                  : 'opacity-50 cursor-not-allowed text-[#52576B] bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342]'
              }`}
            >
              <ImagePlus className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
              <span>
                {imageFile ? 'Change Image' : 'Add Image (Max 5 MB)'}
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !profile || trimmedLength === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 whitespace-nowrap"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isSubmitting ? 'Publishing...' : 'Publish Post'}</span>
          </button>
        </div>
      </form>
    </section>
  );
};
