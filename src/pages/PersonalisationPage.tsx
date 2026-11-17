import React, { useState } from 'react';
import {
  Palette,
  Sparkles,
  Sliders,
  Compass,
  LayoutDashboard,
  Shield,
  Check,
  RotateCcw,
  Download,
  AlertCircle,
  Eye,
  CheckCircle2,
  Trash2,
  Plus,
} from 'lucide-react';
import { ACCENT_COLOR_MAP, usePreferences } from '../context/PreferencesContext';
import { useTheme } from '../context/ThemeContext';
import {
  ALL_ANIME_FORMATS,
  ALL_ANIME_GENRES,
  CURATED_ANIME_CATALOGUE,
} from '../services/catalogue/animeCatalogueService';
import { clearRecommendationFeedback } from '../services/personalisation/recommendationService';
import type {
  AtaAccentColor,
  AtaFeedDensity,
  AtaThemePreference,
  DefaultFeedTab,
  NavDestinationId,
} from '../types';

interface PersonalisationPageProps {
  currentUserId?: string;
  onNavigateDestination?: (id: NavDestinationId) => void;
}

type SettingsTab =
  | 'appearance'
  | 'interests'
  | 'content'
  | 'feed'
  | 'recommendations'
  | 'dashboard'
  | 'privacy';

export const PersonalisationPage: React.FC<PersonalisationPageProps> = ({
  currentUserId,
  onNavigateDestination,
}) => {
  const { preferences, updatePreferences } = usePreferences();
  const { theme, setTheme, resetToSystemPreference } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customAnimeInput, setCustomAnimeInput] = useState('');
  const [customCharInput, setCustomCharInput] = useState('');
  const [avoidTopicInput, setAvoidTopicInput] = useState('');

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleThemeChange = async (pref: AtaThemePreference) => {
    if (pref === 'system') {
      resetToSystemPreference();
    } else {
      setTheme(pref);
    }
    await updatePreferences({ themePreference: pref });
    showNotification('Theme updated.');
  };

  const handleAccentChange = async (color: AtaAccentColor) => {
    await updatePreferences({ accentColor: color });
    showNotification(`Accent colour changed to ${ACCENT_COLOR_MAP[color].name}.`);
  };

  const handleDensityChange = async (density: AtaFeedDensity) => {
    await updatePreferences({ feedDensity: density });
    showNotification(`Feed density changed to ${density}.`);
  };

  const toggleGenre = async (genre: string) => {
    const current = preferences.favouriteGenres || [];
    const updated = current.includes(genre)
      ? current.filter((g) => g !== genre)
      : [...current, genre];
    await updatePreferences({ favouriteGenres: updated });
  };

  const addCustomAnime = async () => {
    const val = customAnimeInput.trim();
    if (!val) return;
    const current = preferences.favouriteAnimeTitles || [];
    if (!current.includes(val)) {
      await updatePreferences({ favouriteAnimeTitles: [...current, val] });
    }
    setCustomAnimeInput('');
    showNotification(`Added "${val}" to favourite anime.`);
  };

  const removeAnime = async (title: string) => {
    const current = preferences.favouriteAnimeTitles || [];
    await updatePreferences({
      favouriteAnimeTitles: current.filter((t) => t !== title),
    });
  };

  const addCustomChar = async () => {
    const val = customCharInput.trim();
    if (!val) return;
    const current = preferences.favouriteCharacters || [];
    if (!current.includes(val)) {
      await updatePreferences({ favouriteCharacters: [...current, val] });
    }
    setCustomCharInput('');
    showNotification(`Added "${val}" to favourite characters.`);
  };

  const removeChar = async (char: string) => {
    const current = preferences.favouriteCharacters || [];
    await updatePreferences({
      favouriteCharacters: current.filter((c) => c !== char),
    });
  };

  const toggleFormat = async (format: string) => {
    const current = preferences.preferredFormats || [];
    const updated = current.includes(format)
      ? current.filter((f) => f !== format)
      : [...current, format];
    await updatePreferences({ preferredFormats: updated });
  };

  const addAvoidTopic = async () => {
    const val = avoidTopicInput.trim();
    if (!val) return;
    const current = preferences.topicsToAvoid || [];
    if (!current.includes(val)) {
      await updatePreferences({ topicsToAvoid: [...current, val] });
    }
    setAvoidTopicInput('');
    showNotification(`Added "${val}" to topics to avoid.`);
  };

  const removeAvoidTopic = async (topic: string) => {
    const current = preferences.topicsToAvoid || [];
    await updatePreferences({
      topicsToAvoid: current.filter((t) => t !== topic),
    });
  };

  const handleExportData = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(preferences, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'ata_personalisation_preferences.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification('Personalisation data exported.');
  };

  const handleClearFeedback = async () => {
    if (!currentUserId) return;
    await clearRecommendationFeedback(currentUserId);
    showNotification('Recommendation feedback cleared.');
  };

  const toggleWidget = async (widgetId: string) => {
    const currentWidgets = preferences.dashboardWidgets || [];
    const updated = currentWidgets.map((w) =>
      w.id === widgetId ? { ...w, enabled: !w.enabled } : w
    );
    await updatePreferences({ dashboardWidgets: updated });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-[#D4D7E2] dark:border-[#303342] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-accent-orbitron text-xs font-bold tracking-widest text-[#EF3038] uppercase">
              Build 06 · Control Centre
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#090B14] dark:text-white tracking-tight mt-1">
            Personalisation
          </h1>
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
            Customize your ATA visual theme, anime interests, feed ranking, and dashboard layout.
          </p>
        </div>

        {/* Success toast */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-500 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-[#D4D7E2] dark:border-[#303342]">
        {[
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'interests', label: 'Anime Interests', icon: Sparkles },
          { id: 'content', label: 'Content Preferences', icon: Sliders },
          { id: 'feed', label: 'Feed Preferences', icon: Compass },
          { id: 'recommendations', label: 'Recommendations', icon: Eye },
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'privacy', label: 'Privacy & Data', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                active
                  ? 'bg-[#EF3038] text-white shadow-md'
                  : 'bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Appearance */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          {/* Theme selector */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Interface Theme
            </h3>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Choose between Space Black dark-first styling or Pure White light mode.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'dark', label: 'Dark (Space Black)' },
                { id: 'light', label: 'Light' },
                { id: 'system', label: 'System Default' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void handleThemeChange(t.id as AtaThemePreference)}
                  className={`p-3.5 rounded-xl border text-xs font-bold text-center transition-all ${
                    preferences.themePreference === t.id
                      ? 'border-[#EF3038] bg-[#EF3038]/10 text-[#090B14] dark:text-white ring-1 ring-[#EF3038]'
                      : 'border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Colour selector */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Accent Colour
            </h3>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Select from approved ATA high-contrast orbital accent colours.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.keys(ACCENT_COLOR_MAP) as AtaAccentColor[]).map((key) => {
                const info = ACCENT_COLOR_MAP[key];
                const active = preferences.accentColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void handleAccentChange(key)}
                    className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      active
                        ? 'border-[#090B14] dark:border-white ring-2 ring-[#EF3038]'
                        : 'border-[#D4D7E2] dark:border-[#303342]'
                    }`}
                  >
                    <span
                      className="h-7 w-7 rounded-full inline-block shadow-md"
                      style={{ backgroundColor: info.hex }}
                    />
                    <span className="text-[11px] font-bold text-[#090B14] dark:text-white truncate">
                      {info.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feed Density */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Feed Density & Reduced Motion
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => void handleDensityChange('comfortable')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  preferences.feedDensity === 'comfortable'
                    ? 'border-[#EF3038] bg-[#EF3038]/5 dark:bg-[#EF3038]/10'
                    : 'border-[#D4D7E2] dark:border-[#303342]'
                }`}
              >
                <p className="text-xs font-bold text-[#090B14] dark:text-white">
                  Comfortable Density
                </p>
                <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] mt-1">
                  Spacious post cards and generous whitespace.
                </p>
              </button>

              <button
                type="button"
                onClick={() => void handleDensityChange('compact')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  preferences.feedDensity === 'compact'
                    ? 'border-[#EF3038] bg-[#EF3038]/5 dark:bg-[#EF3038]/10'
                    : 'border-[#D4D7E2] dark:border-[#303342]'
                }`}
              >
                <p className="text-xs font-bold text-[#090B14] dark:text-white">
                  Compact Density
                </p>
                <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] mt-1">
                  Higher information density with tighter line heights.
                </p>
              </button>
            </div>

            <div className="pt-3 border-t border-[#D4D7E2] dark:border-[#303342] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#090B14] dark:text-white">
                  Reduced Motion
                </p>
                <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                  Minimize animations across transitions and feed cards.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.reducedMotion}
                onChange={(e) => void updatePreferences({ reducedMotion: e.target.checked })}
                className="h-4 w-4 accent-[#EF3038] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Anime Interests */}
      {activeTab === 'interests' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Favourite Genres (22 Available)
            </h3>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Select the genres that define your tastes. These power your &ldquo;For You&rdquo; feed.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {ALL_ANIME_GENRES.map((genre) => {
                const selected = (preferences.favouriteGenres || []).includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => void toggleGenre(genre)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      selected
                        ? 'bg-[#EF3038] text-white border-[#B92335]'
                        : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342]'
                    }`}
                  >
                    {genre}
                    {selected && <Check className="h-3 w-3 inline ml-1.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Favourite Anime Titles */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Favourite Anime Titles
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Frieren: Beyond Journey's End, Cowboy Bebop"
                value={customAnimeInput}
                onChange={(e) => setCustomAnimeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addCustomAnime();
                }}
                className="flex-1 px-4 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
              />
              <button
                type="button"
                onClick={() => void addCustomAnime()}
                className="px-4 py-2 text-xs font-bold text-white bg-[#EF3038] rounded-xl hover:bg-[#B92335] flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {(preferences.favouriteAnimeTitles || []).map((title) => (
                <span
                  key={title}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#EF3038]/10 text-[#EF3038] border border-[#EF3038]/30 flex items-center gap-2"
                >
                  <span>{title}</span>
                  <button
                    type="button"
                    onClick={() => void removeAnime(title)}
                    className="hover:text-white"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Favourite Characters */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Favourite Characters
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Spike Spiegel, Frieren, Shinji Ikari"
                value={customCharInput}
                onChange={(e) => setCustomCharInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addCustomChar();
                }}
                className="flex-1 px-4 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
              />
              <button
                type="button"
                onClick={() => void addCustomChar()}
                className="px-4 py-2 text-xs font-bold text-white bg-[#EF3038] rounded-xl hover:bg-[#B92335] flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {(preferences.favouriteCharacters || []).map((char) => (
                <span
                  key={char}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#090B14] text-[#090B14] dark:text-white border border-[#D4D7E2] dark:border-[#303342] flex items-center gap-2"
                >
                  <span>{char}</span>
                  <button
                    type="button"
                    onClick={() => void removeChar(char)}
                    className="hover:text-[#EF3038]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Content Preferences */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Preferred Formats
            </h3>
            <div className="flex flex-wrap gap-2">
              {ALL_ANIME_FORMATS.map((format) => {
                const selected = (preferences.preferredFormats || []).includes(format);
                return (
                  <button
                    key={format}
                    type="button"
                    onClick={() => void toggleFormat(format)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      selected
                        ? 'bg-[#EF3038] text-white border-[#B92335]'
                        : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342]'
                    }`}
                  >
                    {format}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Topics or Genres to Avoid
            </h3>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              We will suppress feed discussions and recommendation items featuring these topics.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Gore, Isekai, Spoilers"
                value={avoidTopicInput}
                onChange={(e) => setAvoidTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addAvoidTopic();
                }}
                className="flex-1 px-4 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
              />
              <button
                type="button"
                onClick={() => void addAvoidTopic()}
                className="px-4 py-2 text-xs font-bold text-white bg-[#EF3038] rounded-xl hover:bg-[#B92335] flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Avoid</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {(preferences.topicsToAvoid || []).map((topic) => (
                <span
                  key={topic}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#EF3038]/10 text-[#EF3038] border border-[#EF3038]/30 flex items-center gap-2"
                >
                  <span>{topic}</span>
                  <button
                    type="button"
                    onClick={() => void removeAvoidTopic(topic)}
                    className="hover:text-white"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Feed Preferences */}
      {activeTab === 'feed' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
            Default Feed Tab
          </h3>
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
            Choose which feed view automatically opens when you visit ATA Home.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { id: 'for_you', label: 'For You (Personalised)', desc: 'Ranked by your genres & interests' },
              { id: 'following', label: 'Following', desc: 'Accounts you follow' },
              { id: 'communities', label: 'Communities', desc: 'Anime clubs you joined' },
              { id: 'trending', label: 'Trending', desc: 'Highest engagement posts' },
              { id: 'latest', label: 'Latest', desc: 'Chronological feed' },
            ].map((feed) => (
              <button
                key={feed.id}
                type="button"
                onClick={() => void updatePreferences({ defaultFeed: feed.id as DefaultFeedTab })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  preferences.defaultFeed === feed.id
                    ? 'border-[#EF3038] bg-[#EF3038]/5 dark:bg-[#EF3038]/10'
                    : 'border-[#D4D7E2] dark:border-[#303342]'
                }`}
              >
                <p className="text-xs font-bold text-[#090B14] dark:text-white">
                  {feed.label}
                </p>
                <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
                  {feed.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Recommendations */}
      {activeTab === 'recommendations' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#D4D7E2] dark:border-[#303342]">
            <div>
              <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
                Personalised Anime Recommendations
              </h3>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Enable or disable ATA explainable anime discovery cards.
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.recommendationsEnabled}
              onChange={(e) =>
                void updatePreferences({ recommendationsEnabled: e.target.checked })
              }
              className="h-5 w-5 accent-[#EF3038] rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-[#090B14] dark:text-white">
                Clear Recommendation Feedback History
              </h4>
              <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                Resets all &ldquo;Like&rdquo; and &ldquo;Not Interested&rdquo; signals.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleClearFeedback()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white hover:border-[#EF3038]"
            >
              Reset Feedback
            </button>
          </div>
        </div>
      )}

      {/* Tab 6: Dashboard Layout */}
      {activeTab === 'dashboard' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
            Customise &ldquo;My Anime&rdquo; Dashboard Widgets
          </h3>
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
            Toggle which widgets appear on your personal anime dashboard.
          </p>
          <div className="space-y-3 pt-2">
            {(preferences.dashboardWidgets || []).map((widget) => (
              <div
                key={widget.id}
                className="p-3.5 rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] flex items-center justify-between"
              >
                <span className="text-xs font-bold text-[#090B14] dark:text-white">
                  {widget.label}
                </span>
                <input
                  type="checkbox"
                  checked={widget.enabled}
                  onChange={() => void toggleWidget(widget.id)}
                  className="h-4 w-4 accent-[#EF3038] rounded cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 7: Privacy & Data */}
      {activeTab === 'privacy' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Data Privacy & Transparency
            </h3>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Your personalization preferences are private to your account and never shared with third parties.
            </p>
          </div>

          <div className="pt-4 border-t border-[#D4D7E2] dark:border-[#303342] flex flex-wrap gap-4">
            <button
              type="button"
              onClick={handleExportData}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]"
            >
              <Download className="h-4 w-4" />
              <span>Export Personalisation Data (JSON)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
