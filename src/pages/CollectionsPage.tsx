import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  Check,
  FolderPlus,
  Heart,
  Loader2,
  Lock,
  Globe,
  Plus,
  Trash2,
  X,
  ExternalLink,
  Edit2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Layers,
} from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';
import { animeCatalogueService } from '../services/catalogue/animeCatalogueService';
import {
  createCollection,
  deleteCollection,
  getPublicCollections,
  subscribeToUserCollections,
  toggleCollectionLike,
  updateCollection,
} from '../services/personalisation/collectionService';
import type {
  AnimeCatalogueItem,
  CollectionItem,
  CollectionVisibility,
  NavDestinationId,
  UserCollection,
} from '../types';

interface CollectionsPageProps {
  currentUserId?: string;
  onOpenAuth?: () => void;
  onNavigateDestination?: (id: NavDestinationId) => void;
}

export const CollectionsPage: React.FC<CollectionsPageProps> = ({
  currentUserId,
  onOpenAuth,
  onNavigateDestination,
}) => {
  const [activeTab, setActiveTab] = useState<'my' | 'explore'>('my');
  const [myCollections, setMyCollections] = useState<UserCollection[]>([]);
  const [publicCollections, setPublicCollections] = useState<UserCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<UserCollection | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<CollectionVisibility>('public');
  const [items, setItems] = useState<Omit<CollectionItem, 'addedAt'>[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Anime Search inside Modal
  const [animeQuery, setAnimeQuery] = useState('');
  const [animeSearchResults, setAnimeSearchResults] = useState<AnimeCatalogueItem[]>([]);

  // View Details Modal
  const [selectedCollection, setSelectedCollection] = useState<UserCollection | null>(null);
  const [deletingColId, setDeletingColId] = useState<string | null>(null);

  // Load user collections
  useEffect(() => {
    if (!currentUserId) {
      setMyCollections([]);
      setIsLoading(false);
      return;
    }

    const unsub = subscribeToUserCollections(
      currentUserId,
      (list) => {
        setMyCollections(list);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, [currentUserId]);

  // Load public collections only when exploring community lists
  useEffect(() => {
    if (activeTab !== 'explore') return;
    let cancelled = false;
    getPublicCollections(30)
      .then((cols) => {
        if (!cancelled) {
          setPublicCollections(cols || []);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  // Anime search inside modal
  useEffect(() => {
    if (!isModalOpen) return;
    animeCatalogueService.searchAnime(animeQuery).then(setAnimeSearchResults);
  }, [animeQuery, isModalOpen]);

  const handleOpenCreate = () => {
    setEditingCollection(null);
    setTitle('');
    setDescription('');
    setVisibility('public');
    setItems([]);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (col: UserCollection) => {
    setEditingCollection(col);
    setTitle(col.title);
    setDescription(col.description);
    setVisibility(col.visibility);
    setItems(col.items);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleAddAnimeToCollection = (anime: AnimeCatalogueItem) => {
    if (items.some((it) => it.animeId === anime.id)) return;
    setItems((prev) => [
      ...prev,
      {
        id: anime.id,
        animeId: anime.id,
        title: anime.title,
        coverImage: anime.coverImage,
        format: anime.format,
        position: prev.length,
      },
    ]);
  };

  const handleRemoveAnime = (animeId: string) => {
    setItems((prev) =>
      prev
        .filter((it) => it.animeId !== animeId)
        .map((it, idx) => ({ ...it, position: idx }))
    );
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const reordered = [...items];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    setItems(reordered.map((it, idx) => ({ ...it, position: idx })));
  };

  const handleSaveCollection = async () => {
    if (!currentUserId) return;
    if (!title.trim()) {
      setModalError('Collection title is required.');
      return;
    }

    setIsSaving(true);
    setModalError(null);

    try {
      if (editingCollection) {
        await updateCollection(currentUserId, editingCollection.id, {
          title: title.trim(),
          description: description.trim(),
          visibility,
          items,
        });
      } else {
        await createCollection(currentUserId, {
          title: title.trim(),
          description: description.trim(),
          visibility,
          items,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save collection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUserId || !deletingColId) return;
    await deleteCollection(currentUserId, deletingColId);
    setDeletingColId(null);
    if (selectedCollection?.id === deletingColId) {
      setSelectedCollection(null);
    }
  };

  const handleLike = async (col: UserCollection) => {
    if (!currentUserId) {
      onOpenAuth?.();
      return;
    }
    const result = await toggleCollectionLike(currentUserId, col.id);
    setPublicCollections((prev) =>
      prev.map((c) => (c.id === col.id ? { ...c, likeCount: result.likeCount } : c))
    );
    setMyCollections((prev) =>
      prev.map((c) => (c.id === col.id ? { ...c, likeCount: result.likeCount } : c))
    );
    if (selectedCollection?.id === col.id) {
      setSelectedCollection((prev) =>
        prev ? { ...prev, likeCount: result.likeCount } : null
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-[#D4D7E2] dark:border-[#303342] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-accent-orbitron text-xs font-bold tracking-widest text-[#EF3038] uppercase">
              Curated Lists
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#090B14] dark:text-white tracking-tight mt-1">
            Custom Anime Collections
          </h1>
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
            Curate themed lists like Top 10 Mecha, Best Soundtracks, or Holiday Marathons.
          </p>
        </div>

        {currentUserId && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] transition-colors shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Create Collection</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-[#D4D7E2] dark:border-[#303342]">
        <button
          type="button"
          onClick={() => setActiveTab('my')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'my'
              ? 'border-[#EF3038] text-[#EF3038]'
              : 'border-transparent text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>My Collections ({myCollections.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('explore')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'explore'
              ? 'border-[#EF3038] text-[#EF3038]'
              : 'border-transparent text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
          }`}
        >
          <Globe className="h-4 w-4" />
          <span>Explore Community Lists ({publicCollections.length})</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'my' ? (
        !currentUserId ? (
          <div className="py-16 text-center space-y-4">
            <Lock className="h-10 w-10 text-[#EF3038] mx-auto" />
            <h3 className="text-base font-bold text-[#090B14] dark:text-white">
              Sign In to Build Collections
            </h3>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] max-w-sm mx-auto">
              Create your own public and private anime lists and share your tastes with ATA.
            </p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-5 py-2 text-xs font-bold text-white bg-[#EF3038] rounded-xl hover:bg-[#B92335]"
            >
              Sign In
            </button>
          </div>
        ) : isLoading ? (
          <div className="py-20 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#EF3038]" />
          </div>
        ) : myCollections.length === 0 ? (
          <div className="py-20 px-6 rounded-3xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-center space-y-3">
            <Layers className="h-10 w-10 text-[#52576B] dark:text-[#A7A9B8] mx-auto" />
            <p className="text-sm font-bold text-[#090B14] dark:text-white">
              No collections created yet
            </p>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] max-w-sm mx-auto">
              Start your first curated list! Pick a theme and add your favourite series.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 px-5 py-2 text-xs font-bold text-white bg-[#EF3038] rounded-xl hover:bg-[#B92335]"
            >
              Create My First Collection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myCollections.map((col) => (
              <div
                key={col.id}
                onClick={() => setSelectedCollection(col)}
                className="p-4 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#090B14] dark:hover:border-white/50 transition-all cursor-pointer flex flex-col justify-between group space-y-3"
              >
                <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-black/20 relative">
                  {col.coverImageUrl ? (
                    <img
                      src={col.coverImageUrl}
                      alt={col.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs font-bold text-[#A7A9B8]">
                      ATA Collection
                    </div>
                  )}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md bg-black/60 text-white flex items-center gap-1">
                    {col.visibility === 'private' ? (
                      <>
                        <Lock className="h-3 w-3" />
                        <span>Private</span>
                      </>
                    ) : (
                      <>
                        <Globe className="h-3 w-3" />
                        <span>Public</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#090B14] dark:text-white group-hover:text-[#EF3038] transition-colors line-clamp-1">
                    {col.title}
                  </h3>
                  <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] line-clamp-2">
                    {col.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#D4D7E2] dark:border-[#303342] flex items-center justify-between text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                  <span>{col.itemCount} anime</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(col);
                      }}
                      className="hover:text-[#EF3038]"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingColId(col.id);
                      }}
                      className="hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Explore Community Collections */
        publicCollections.length === 0 ? (
          <div className="py-20 px-6 rounded-3xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-center space-y-3">
            <Globe className="h-10 w-10 text-[#52576B] dark:text-[#A7A9B8] mx-auto" />
            <p className="text-sm font-bold text-[#090B14] dark:text-white">
              No public collections available yet
            </p>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Be the first to publish a public list for the ATA community!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicCollections.map((col) => (
              <div
                key={col.id}
                onClick={() => setSelectedCollection(col)}
                className="p-4 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#090B14] dark:hover:border-white/50 transition-all cursor-pointer flex flex-col justify-between group space-y-3"
              >
                <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-black/20 relative">
                  {col.coverImageUrl ? (
                    <img
                      src={col.coverImageUrl}
                      alt={col.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs font-bold text-[#A7A9B8]">
                      ATA Collection
                    </div>
                  )}
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md bg-black/60 text-white">
                    {col.itemCount} anime
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#090B14] dark:text-white group-hover:text-[#EF3038] transition-colors line-clamp-1">
                    {col.title}
                  </h3>
                  <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] line-clamp-2">
                    {col.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#D4D7E2] dark:border-[#303342] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <UserAvatar
                      displayName={col.ownerDisplayName}
                      avatarUrl={col.ownerAvatarUrl}
                      size="sm"
                    />
                    <span className="text-[11px] font-semibold text-[#090B14] dark:text-white truncate max-w-[100px]">
                      {col.ownerDisplayName}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleLike(col);
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038] transition-colors"
                  >
                    <Heart className="h-4 w-4" />
                    <span>{col.likeCount || 0}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Collection Details Modal */}
      {selectedCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#090B14] border-b border-[#303342] flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="font-accent-orbitron text-[10px] font-bold tracking-widest text-[#EF3038] uppercase">
                  {selectedCollection.visibility.toUpperCase()} COLLECTION
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCollection(null)}
                className="text-[#A7A9B8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div>
                <h2 className="text-xl font-black text-[#090B14] dark:text-white">
                  {selectedCollection.title}
                </h2>
                <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] mt-1">
                  Curated by {selectedCollection.ownerDisplayName} · {selectedCollection.items.length} titles
                </p>
                {selectedCollection.description && (
                  <p className="text-xs text-[#090B14] dark:text-white/90 mt-2 p-3 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342]">
                    {selectedCollection.description}
                  </p>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-[#090B14] dark:text-white uppercase tracking-wider">
                  Anime in this collection
                </h4>
                {selectedCollection.items.map((item, index) => (
                  <div
                    key={item.id || item.animeId}
                    className="p-3 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] flex items-center gap-3"
                  >
                    <span className="text-xs font-black text-[#EF3038] w-5 tabular-nums text-center">
                      #{index + 1}
                    </span>
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="h-12 w-9 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#090B14] dark:text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-[#52576B] dark:text-[#A7A9B8]">
                        {item.format || 'TV Series'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 bg-[#F4F5F8] dark:bg-[#090B14] border-t border-[#D4D7E2] dark:border-[#303342] flex items-center justify-between">
              <button
                type="button"
                onClick={() => void handleLike(selectedCollection)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#EF3038] bg-[#EF3038]/10 hover:bg-[#EF3038]/20 transition-colors"
              >
                <Heart className="h-4 w-4 fill-current" />
                <span>Like Collection ({selectedCollection.likeCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCollection(null)}
                className="px-4 py-2 text-xs font-bold text-[#52576B] dark:text-[#A7A9B8]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#090B14] border-b border-[#303342] flex items-center justify-between text-white">
              <h2 className="text-sm font-bold">
                {editingCollection ? 'Edit Collection' : 'Create New Collection'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#A7A9B8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {modalError && (
                <div className="p-3 rounded-xl bg-[#EF3038]/10 border border-[#EF3038]/30 text-xs text-[#EF3038] font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[#090B14] dark:text-white block mb-1">
                  Collection Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Peak Mecha Classics, Underrated 2024 Gems"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#090B14] dark:text-white block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="What makes this list special? Share context or why you recommend these series."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#090B14] dark:text-white block mb-1">
                  Visibility
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      visibility === 'public'
                        ? 'border-[#EF3038] bg-[#EF3038]/10'
                        : 'border-[#D4D7E2] dark:border-[#303342]'
                    }`}
                  >
                    <p className="text-xs font-bold text-[#090B14] dark:text-white">
                      Public Collection
                    </p>
                    <p className="text-[10px] text-[#52576B] dark:text-[#A7A9B8]">
                      Visible to all ATA community members
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibility('private')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      visibility === 'private'
                        ? 'border-[#EF3038] bg-[#EF3038]/10'
                        : 'border-[#D4D7E2] dark:border-[#303342]'
                    }`}
                  >
                    <p className="text-xs font-bold text-[#090B14] dark:text-white">
                      Private List
                    </p>
                    <p className="text-[10px] text-[#52576B] dark:text-[#A7A9B8]">
                      Only visible to you
                    </p>
                  </button>
                </div>
              </div>

              {/* Add Anime from Catalogue */}
              <div className="space-y-2 pt-2 border-t border-[#D4D7E2] dark:border-[#303342]">
                <label className="text-xs font-bold text-[#090B14] dark:text-white block">
                  Add Anime to Collection
                </label>
                <input
                  type="text"
                  placeholder="Search series by title..."
                  value={animeQuery}
                  onChange={(e) => setAnimeQuery(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
                />

                {animeSearchResults.length > 0 && (
                  <div className="max-h-32 overflow-y-auto divide-y divide-[#D4D7E2] dark:divide-[#303342] border border-[#D4D7E2] dark:border-[#303342] rounded-xl bg-white dark:bg-[#090B14]">
                    {animeSearchResults.slice(0, 5).map((anime) => {
                      const added = items.some((it) => it.animeId === anime.id);
                      return (
                        <div
                          key={anime.id}
                          className="p-2 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <img
                              src={anime.coverImage}
                              alt={anime.title}
                              className="h-8 w-6 object-cover rounded"
                            />
                            <span className="font-bold text-[#090B14] dark:text-white truncate">
                              {anime.title}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={added}
                            onClick={() => handleAddAnimeToCollection(anime)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold ${
                              added
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-[#EF3038] text-white hover:bg-[#B92335]'
                            }`}
                          >
                            {added ? 'Added' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Added Items (Reorderable) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#090B14] dark:text-white block">
                  Items in this list ({items.length})
                </label>
                {items.length === 0 ? (
                  <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                    No anime added yet. Use the search bar above to include titles.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {items.map((it, idx) => (
                      <div
                        key={it.animeId}
                        className="p-2.5 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] flex items-center gap-2.5 text-xs font-bold text-[#090B14] dark:text-white"
                      >
                        <span className="text-[10px] text-[#EF3038] w-4 text-center">
                          {idx + 1}
                        </span>
                        <img
                          src={it.coverImage}
                          alt={it.title}
                          className="h-8 w-6 object-cover rounded"
                        />
                        <span className="flex-1 truncate">{it.title}</span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveItem(idx, 'up')}
                            className="p-1 hover:text-[#EF3038] disabled:opacity-30"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === items.length - 1}
                            onClick={() => handleMoveItem(idx, 'down')}
                            className="p-1 hover:text-[#EF3038] disabled:opacity-30"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveAnime(it.animeId)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-[#F4F5F8] dark:bg-[#090B14] border-t border-[#D4D7E2] dark:border-[#303342] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-[#52576B] dark:text-[#A7A9B8]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSaveCollection()}
                className="px-5 py-2 text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] rounded-xl flex items-center gap-1.5 shadow-md"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Collection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingColId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-sm w-full p-6 rounded-3xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Delete Collection?
            </h3>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Are you sure you want to permanently delete this collection?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingColId(null)}
                className="px-4 py-2 text-xs font-bold text-[#52576B] dark:text-[#A7A9B8]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
