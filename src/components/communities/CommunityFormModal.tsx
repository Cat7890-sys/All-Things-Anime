import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  ImagePlus,
  Lock,
  Plus,
  Save,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  createCommunity,
  isCommunitySlugAvailable,
  updateCommunityDetails,
} from '../../services/communityService';
import { isStorageConfigured } from '../../services/firebase';
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_DESC_MAX,
  COMMUNITY_MAX_RULES,
  COMMUNITY_MAX_TAGS,
  COMMUNITY_NAME_MAX,
  COMMUNITY_RULE_MAX_LEN,
  COMMUNITY_SLUG_MAX,
  COMMUNITY_TAG_MAX_LEN,
  slugifyCommunityName,
  validateCommunitySlug,
  validateCreateCommunityForm,
  validatePostImageFile,
  validateUpdateCommunityForm,
} from '../../services/validation';
import type {
  AtaCommunity,
  AtaUserAccount,
  CommunityCategory,
  CommunityVisibility,
} from '../../types';

interface CommunityFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  creatorProfile: AtaUserAccount | null;
  existingCommunity?: AtaCommunity | null;
  onClose: () => void;
  onSaved: (community: AtaCommunity) => void;
}

export const CommunityFormModal: React.FC<CommunityFormModalProps> = ({
  isOpen,
  mode,
  creatorProfile,
  existingCommunity,
  onClose,
  onSaved,
}) => {
  const { isOnline } = useOnlineStatus();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CommunityCategory>('General');
  const [visibility, setVisibility] = useState<CommunityVisibility>('public');

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [rules, setRules] = useState<string[]>([]);
  const [ruleInput, setRuleInput] = useState('');

  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [coverUrl, setCoverUrl] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setTagInput('');
    setRuleInput('');
    setAvatarFile(null);
    setCoverFile(null);
    setRemoveAvatar(false);
    setRemoveCover(false);

    if (mode === 'edit' && existingCommunity) {
      setName(existingCommunity.name);
      setSlug(existingCommunity.slug);
      setSlugManuallyEdited(true);
      setSlugStatus('available');
      setDescription(existingCommunity.description);
      setCategory(existingCommunity.category);
      setVisibility(existingCommunity.visibility);
      setTags(existingCommunity.animeTags);
      setRules(existingCommunity.rules);
      setAvatarUrl(existingCommunity.avatarUrl);
      setCoverUrl(existingCommunity.coverUrl);
      setAvatarPreviewUrl(null);
      setCoverPreviewUrl(null);
    } else {
      setName('');
      setSlug('');
      setSlugManuallyEdited(false);
      setSlugStatus('idle');
      setDescription('');
      setCategory('General');
      setVisibility('public');
      setTags([]);
      setRules([]);
      setAvatarUrl('');
      setCoverUrl('');
      setAvatarPreviewUrl(null);
      setCoverPreviewUrl(null);
    }
  }, [isOpen, mode, existingCommunity]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  useEffect(() => {
    if (!isOpen || mode !== 'create') return;
    const trimmed = slug.trim().toLowerCase();
    if (!trimmed) {
      setSlugStatus('idle');
      return;
    }
    if (validateCommunitySlug(trimmed)) {
      setSlugStatus('invalid');
      return;
    }
    setSlugStatus('checking');
    const timer = window.setTimeout(() => {
      void isCommunitySlugAvailable(trimmed).then((available) => {
        setSlugStatus(available ? 'available' : 'taken');
      });
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [slug, isOpen, mode]);

  if (!isOpen) return null;

  const handleNameChange = (value: string) => {
    setName(value);
    if (mode === 'create' && !slugManuallyEdited) {
      setSlug(slugifyCommunityName(value));
    }
    if (error) setError(null);
  };

  const handleAddTag = () => {
    const candidate = tagInput.trim();
    if (!candidate) return;
    if (tags.length >= COMMUNITY_MAX_TAGS) {
      setError(`You can add up to ${COMMUNITY_MAX_TAGS} anime tags.`);
      return;
    }
    if (candidate.length > COMMUNITY_TAG_MAX_LEN) {
      setError(`Tags must be ${COMMUNITY_TAG_MAX_LEN} characters or fewer.`);
      return;
    }
    if (tags.some((t) => t.toLowerCase() === candidate.toLowerCase())) {
      setTagInput('');
      return;
    }
    setTags((prev) => [...prev, candidate]);
    setTagInput('');
    setError(null);
  };

  const handleAddRule = () => {
    const candidate = ruleInput.trim();
    if (!candidate) return;
    if (rules.length >= COMMUNITY_MAX_RULES) {
      setError(`You can define up to ${COMMUNITY_MAX_RULES} rules.`);
      return;
    }
    if (candidate.length < 3 || candidate.length > COMMUNITY_RULE_MAX_LEN) {
      setError(
        `Each rule must be between 3 and ${COMMUNITY_RULE_MAX_LEN} characters.`
      );
      return;
    }
    setRules((prev) => [...prev, candidate]);
    setRuleInput('');
    setError(null);
  };

  const handleFileChange = (
    kind: 'avatar' | 'cover',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setError(null);
    const selected = e.target.files?.[0] || null;
    if (!selected) return;

    const fileErr = validatePostImageFile(selected);
    if (fileErr) {
      setError(fileErr);
      e.target.value = '';
      return;
    }

    const preview = URL.createObjectURL(selected);
    if (kind === 'avatar') {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarFile(selected);
      setAvatarPreviewUrl(preview);
      setRemoveAvatar(false);
    } else {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
      setCoverFile(selected);
      setCoverPreviewUrl(preview);
      setRemoveCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isOnline) {
      setError(
        'You are offline. Creating or editing a community requires an active connection.'
      );
      return;
    }

    setError(null);

    if (mode === 'create') {
      if (!creatorProfile) {
        setError('Please sign in with a verified ATA account first.');
        return;
      }
      if (slugStatus === 'taken') {
        setError(
          `The slug "${slug.trim().toLowerCase()}" is already taken. Please choose another.`
        );
        return;
      }

      const payload = {
        name,
        slug: slug.trim().toLowerCase(),
        description,
        category,
        animeTags: tags,
        rules,
        visibility,
        avatarUrl,
        coverUrl,
        avatarFile,
        coverFile,
      };

      const validationErr = validateCreateCommunityForm(payload);
      if (validationErr) {
        setError(validationErr);
        return;
      }

      setIsSubmitting(true);
      try {
        const created = await createCommunity(creatorProfile, payload);
        onSaved(created);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to create community right now.'
        );
      } finally {
        setIsSubmitting(false);
      }
    } else if (existingCommunity) {
      const payload = {
        name,
        description,
        category,
        animeTags: tags,
        rules,
        avatarUrl,
        coverUrl,
        avatarFile,
        coverFile,
        removeAvatar,
        removeCover,
      };

      const validationErr = validateUpdateCommunityForm(payload);
      if (validationErr) {
        setError(validationErr);
        return;
      }

      setIsSubmitting(true);
      try {
        const updated = await updateCommunityDetails(
          existingCommunity,
          payload
        );
        onSaved(updated);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to save community updates right now.'
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ata-community-form-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#090B14] px-5 py-4 border-b border-[#303342] flex items-center justify-between gap-3">
          <div>
            <p className="font-accent-orbitron text-[10px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
              ATA Communities
            </p>
            <h2
              id="ata-community-form-title"
              className="font-display-space font-bold text-lg sm:text-xl text-white mt-0.5"
            >
              {mode === 'create'
                ? 'Create an Anime Community'
                : 'Edit Community Details'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close community form"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#303342] bg-[#171923] text-white hover:border-[#EF3038] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 sm:p-6 overflow-y-auto space-y-5"
        >
          {!isOnline && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038]/70 p-3 text-xs text-[#090B14] dark:text-white"
            >
              <WifiOff
                className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                You are offline. Saving community changes requires an internet
                connection.
              </span>
            </div>
          )}

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

          {/* Community Name & Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="ata-comm-name"
                  className="text-xs font-semibold text-[#090B14] dark:text-white"
                >
                  Community Name
                </label>
                <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                  {name.trim().length}/{COMMUNITY_NAME_MAX}
                </span>
              </div>
              <input
                id="ata-comm-name"
                type="text"
                maxLength={COMMUNITY_NAME_MAX}
                required
                disabled={isSubmitting}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Sakuga Frame Study"
                className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2.5 min-h-[42px] text-sm text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="ata-comm-slug"
                  className="text-xs font-semibold text-[#090B14] dark:text-white"
                >
                  Unique Slug
                </label>
                <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                  {slug.length}/{COMMUNITY_SLUG_MAX}
                </span>
              </div>
              <input
                id="ata-comm-slug"
                type="text"
                maxLength={COMMUNITY_SLUG_MAX}
                required
                disabled={isSubmitting || mode === 'edit'}
                value={slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                placeholder="sakuga-frame-study"
                className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2.5 min-h-[42px] text-sm text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none disabled:opacity-60"
              />
              {mode === 'create' && slugStatus !== 'idle' && (
                <p
                  className={`mt-1 text-[11px] font-medium flex items-center gap-1 ${
                    slugStatus === 'available'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : slugStatus === 'taken' || slugStatus === 'invalid'
                        ? 'text-[#B92335] dark:text-[#EF3038]'
                        : 'text-[#52576B] dark:text-[#A7A9B8]'
                  }`}
                >
                  {slugStatus === 'checking' && 'Checking availability...'}
                  {slugStatus === 'available' && (
                    <>
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      <span>Slug @{slug} is available</span>
                    </>
                  )}
                  {slugStatus === 'taken' &&
                    `Slug "@${slug}" is already in use.`}
                  {slugStatus === 'invalid' &&
                    'Use 3–40 lowercase letters, numbers, or single hyphens.'}
                </p>
              )}
              {mode === 'edit' && (
                <p className="mt-1 text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                  Unique community slugs remain fixed after creation.
                </p>
              )}
            </div>
          </div>

          {/* Category & Visibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="ata-comm-category"
                className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
              >
                Anime Category
              </label>
              <select
                id="ata-comm-category"
                disabled={isSubmitting}
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as CommunityCategory)
                }
                className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2.5 min-h-[42px] text-sm text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
              >
                {COMMUNITY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {mode === 'create' && (
              <div>
                <span className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1">
                  Community Visibility
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setVisibility('public')}
                    className={`flex items-center justify-center gap-1.5 min-h-[42px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                      visibility === 'public'
                        ? 'bg-[#EF3038] text-white border-[#B92335]'
                        : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342]'
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Public</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setVisibility('private')}
                    className={`flex items-center justify-center gap-1.5 min-h-[42px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                      visibility === 'private'
                        ? 'bg-[#EF3038] text-white border-[#B92335]'
                        : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342]'
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Private</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="ata-comm-description"
                className="text-xs font-semibold text-[#090B14] dark:text-white"
              >
                Description (10–{COMMUNITY_DESC_MAX} characters)
              </label>
              <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                {description.trim().length}/{COMMUNITY_DESC_MAX}
              </span>
            </div>
            <textarea
              id="ata-comm-description"
              rows={3}
              maxLength={COMMUNITY_DESC_MAX}
              required
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the anime focus, watch cadence, and discussion tone of this community..."
              className="w-full resize-y rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3 text-sm text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
            />
          </div>

          {/* Anime Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="ata-comm-tag-input"
                className="text-xs font-semibold text-[#090B14] dark:text-white"
              >
                Anime Tags (Optional · Up to {COMMUNITY_MAX_TAGS})
              </label>
              <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                {tags.length}/{COMMUNITY_MAX_TAGS}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                id="ata-comm-tag-input"
                type="text"
                maxLength={COMMUNITY_TAG_MAX_LEN}
                disabled={isSubmitting || tags.length >= COMMUNITY_MAX_TAGS}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="e.g., Frieren, Gundam, Sakuga"
                className="flex-1 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 min-h-[40px] text-xs sm:text-sm text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
              />
              <button
                type="button"
                disabled={
                  isSubmitting ||
                  !tagInput.trim() ||
                  tags.length >= COMMUNITY_MAX_TAGS
                }
                onClick={handleAddTag}
                className="inline-flex items-center gap-1 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038] disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                <span>Add Tag</span>
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setTags((prev) => prev.filter((x) => x !== t))
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038]"
                    title={`Remove tag ${t}`}
                  >
                    <span>{t}</span>
                    <X className="h-3 w-3 text-[#EF3038]" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Community Rules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="ata-comm-rule-input"
                className="text-xs font-semibold text-[#090B14] dark:text-white"
              >
                Community Rules (Optional · Up to {COMMUNITY_MAX_RULES})
              </label>
              <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                {rules.length}/{COMMUNITY_MAX_RULES}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                id="ata-comm-rule-input"
                type="text"
                maxLength={COMMUNITY_RULE_MAX_LEN}
                disabled={isSubmitting || rules.length >= COMMUNITY_MAX_RULES}
                value={ruleInput}
                onChange={(e) => setRuleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRule();
                  }
                }}
                placeholder="e.g., Tag all manga spoilers beyond the latest episode."
                className="flex-1 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 min-h-[40px] text-xs sm:text-sm text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none"
              />
              <button
                type="button"
                disabled={
                  isSubmitting ||
                  ruleInput.trim().length < 3 ||
                  rules.length >= COMMUNITY_MAX_RULES
                }
                onClick={handleAddRule}
                className="inline-flex items-center gap-1 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038] disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                <span>Add Rule</span>
              </button>
            </div>
            {rules.length > 0 && (
              <ol className="space-y-2 pt-1">
                {rules.map((r, index) => (
                  <li
                    key={`${index}-${r}`}
                    className="flex items-start justify-between gap-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-2.5 text-xs text-[#090B14] dark:text-white"
                  >
                    <span>
                      <strong className="text-[#EF3038] mr-1.5 tabular-nums">
                        {String(index + 1).padStart(2, '0')}.
                      </strong>
                      {r}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRules((prev) => prev.filter((_, i) => i !== index))
                      }
                      aria-label={`Remove rule ${index + 1}`}
                      className="text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038] shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Community Artwork (Avatar & Cover) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-[#D4D7E2] dark:border-[#303342]">
            {/* Profile Image */}
            <div className="space-y-2">
              <label
                htmlFor="ata-comm-avatar-url"
                className="block text-xs font-semibold text-[#090B14] dark:text-white"
              >
                Club Profile Image (Optional)
              </label>
              <input
                id="ata-comm-avatar-url"
                type="url"
                disabled={isSubmitting || Boolean(avatarFile)}
                value={removeAvatar ? '' : avatarUrl}
                onChange={(e) => {
                  setRemoveAvatar(false);
                  setAvatarUrl(e.target.value);
                }}
                placeholder="https://... or upload image"
                className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 min-h-[38px] text-xs text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none disabled:opacity-60"
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={avatarInputRef}
                  id="ata-comm-avatar-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={isSubmitting || !isStorageConfigured}
                  onChange={(e) => handleFileChange('avatar', e)}
                  className="sr-only"
                />
                <label
                  htmlFor="ata-comm-avatar-file"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border ${
                    isStorageConfigured
                      ? 'cursor-pointer bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white hover:border-[#EF3038]'
                      : 'opacity-50 cursor-not-allowed bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342] text-[#52576B]'
                  }`}
                >
                  <ImagePlus className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                  <span>{avatarFile ? 'Change File' : 'Upload File'}</span>
                </label>

                {(avatarFile || (!removeAvatar && avatarUrl)) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                      setAvatarPreviewUrl(null);
                      setAvatarFile(null);
                      setAvatarUrl('');
                      setRemoveAvatar(true);
                      if (avatarInputRef.current) avatarInputRef.current.value = '';
                    }}
                    className="text-xs font-semibold text-[#B92335] dark:text-[#EF3038] hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              {(avatarPreviewUrl || (!removeAvatar && avatarUrl)) && (
                <img
                  src={avatarPreviewUrl || avatarUrl}
                  alt="Community avatar preview"
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded-xl object-cover border border-[#D4D7E2] dark:border-[#303342]"
                />
              )}
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <label
                htmlFor="ata-comm-cover-url"
                className="block text-xs font-semibold text-[#090B14] dark:text-white"
              >
                Club Cover Banner (Optional)
              </label>
              <input
                id="ata-comm-cover-url"
                type="url"
                disabled={isSubmitting || Boolean(coverFile)}
                value={removeCover ? '' : coverUrl}
                onChange={(e) => {
                  setRemoveCover(false);
                  setCoverUrl(e.target.value);
                }}
                placeholder="https://... or upload banner"
                className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 min-h-[38px] text-xs text-[#090B14] dark:text-white focus:border-[#EF3038] focus:outline-none disabled:opacity-60"
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={coverInputRef}
                  id="ata-comm-cover-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={isSubmitting || !isStorageConfigured}
                  onChange={(e) => handleFileChange('cover', e)}
                  className="sr-only"
                />
                <label
                  htmlFor="ata-comm-cover-file"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border ${
                    isStorageConfigured
                      ? 'cursor-pointer bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white hover:border-[#EF3038]'
                      : 'opacity-50 cursor-not-allowed bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342] text-[#52576B]'
                  }`}
                >
                  <ImagePlus className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                  <span>{coverFile ? 'Change Banner' : 'Upload Banner'}</span>
                </label>

                {(coverFile || (!removeCover && coverUrl)) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
                      setCoverPreviewUrl(null);
                      setCoverFile(null);
                      setCoverUrl('');
                      setRemoveCover(true);
                      if (coverInputRef.current) coverInputRef.current.value = '';
                    }}
                    className="text-xs font-semibold text-[#B92335] dark:text-[#EF3038] hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              {(coverPreviewUrl || (!removeCover && coverUrl)) && (
                <img
                  src={coverPreviewUrl || coverUrl}
                  alt="Community cover preview"
                  referrerPolicy="no-referrer"
                  className="h-14 w-full rounded-xl object-cover border border-[#D4D7E2] dark:border-[#303342]"
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D4D7E2] dark:border-[#303342]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 min-h-[42px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !isOnline ||
                (mode === 'create' && slugStatus === 'taken')
              }
              className="inline-flex items-center gap-2 px-5 py-2 min-h-[42px] text-xs sm:text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>
                {isSubmitting
                  ? mode === 'create'
                    ? 'Creating...'
                    : 'Saving...'
                  : mode === 'create'
                    ? 'Create Community'
                    : 'Save Changes'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
