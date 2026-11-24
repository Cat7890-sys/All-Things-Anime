import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  ExternalLink,
  Filter,
  Newspaper,
  Search,
  Share2,
  Sparkles,
} from 'lucide-react';
import type { AnimeNewsArticle, NewsCategory } from '../types';
import {
  FEATURED_ANIME_NEWS,
  subscribeToUserNewsBookmarks,
  toggleNewsBookmark,
} from '../services/companion/newsService';
import { useAuth } from '../hooks/useAuth';

interface NewsCenterPageProps {
  currentUserId?: string;
  onOpenAuth: () => void;
}

const CATEGORIES: Array<NewsCategory | 'All'> = [
  'All',
  'Industry',
  'Releases',
  'Reviews',
  'Interviews',
  'Events',
];

export const NewsCenterPage: React.FC<NewsCenterPageProps> = ({
  currentUserId,
  onOpenAuth,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUserId) {
      setBookmarkedIds(new Set());
      return;
    }
    const unsub = subscribeToUserNewsBookmarks(currentUserId, (ids) => {
      setBookmarkedIds(ids);
    });
    return () => {
      unsub();
    };
  }, [currentUserId]);

  const handleToggleBookmark = async (article: AnimeNewsArticle) => {
    if (!currentUserId) {
      onOpenAuth();
      return;
    }
    const isBookmarked = bookmarkedIds.has(article.id);
    await toggleNewsBookmark(currentUserId, article, isBookmarked);
  };

  const filteredArticles = FEATURED_ANIME_NEWS.filter((article) => {
    if (selectedCategory !== 'All' && article.category !== selectedCategory) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      article.title.toLowerCase().includes(q) ||
      article.summary.toLowerCase().includes(q) ||
      article.source.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#171923] via-[#090B14] to-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-6 sm:p-8">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EF3038]/10 text-[#EF3038] text-xs font-bold tracking-wide uppercase">
            <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />
            <span>ATA News Centre</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#090B14] dark:text-white">
            Anime Industry & Release Dispatch
          </h1>
          <p className="text-sm text-[#52576B] dark:text-[#A7A9B8]">
            Stay informed with verified production announcements, director interviews, seasonal reviews, and festival event schedules.
          </p>
        </div>
      </div>

      {/* Controls & Categories */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                selectedCategory === cat
                  ? 'bg-[#EF3038] text-white shadow-sm'
                  : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52576B] dark:text-[#A7A9B8]" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search news articles..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-xl text-xs sm:text-sm text-[#090B14] dark:text-white placeholder-[#52576B] focus:outline-none focus:border-[#EF3038]"
          />
        </div>
      </div>

      {/* Article Grid */}
      {filteredArticles.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
          No news articles found matching your criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map((article) => {
            const isBookmarked = bookmarkedIds.has(article.id);
            return (
              <article
                key={article.id}
                className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden shadow-sm hover:border-[#EF3038] transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-48 overflow-hidden bg-[#D4D7E2] dark:bg-[#303342]">
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-white text-[10px] font-bold">
                      {article.category}
                    </span>
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#52576B] dark:text-[#A7A9B8]">
                      <span className="font-semibold text-[#090B14] dark:text-white">{article.source}</span>
                      <span>{article.publishedAt}</span>
                    </div>

                    <h2 className="text-base font-bold text-[#090B14] dark:text-white line-clamp-2 leading-snug">
                      {article.title}
                    </h2>

                    <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] line-clamp-3 leading-relaxed">
                      {article.summary}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-[#D4D7E2] dark:border-[#303342]">
                  <span className="text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8]">
                    By {article.author}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggleBookmark(article)}
                      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark article'}
                      className={`p-2 rounded-xl border transition-colors ${
                        isBookmarked
                          ? 'bg-[#EF3038] text-white border-[#B92335]'
                          : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
                      }`}
                    >
                      <Bookmark className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Read full article on source"
                      className="p-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-[#A7A9B8] hover:border-[#EF3038] transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
