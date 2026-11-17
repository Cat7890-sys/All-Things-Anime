import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Compass,
  Film,
  Sliders,
  Bookmark,
} from 'lucide-react';
import { usePreferences } from '../../context/PreferencesContext';
import {
  ALL_ANIME_FORMATS,
  ALL_ANIME_GENRES,
  ALL_RELEASE_PERIODS,
  CURATED_ANIME_CATALOGUE,
} from '../../services/catalogue/animeCatalogueService';
import type { AtaAccentColor, AtaFeedDensity } from '../../types';
import { ACCENT_COLOR_MAP } from '../../context/PreferencesContext';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PersonalisationOnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { preferences, updatePreferences, setIsOnboardingOpen } = usePreferences();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    preferences.favouriteGenres || ['Action', 'Adventure', 'Fantasy & Isekai']
  );
  const [selectedAnime, setSelectedAnime] = useState<string[]>(
    preferences.favouriteAnimeTitles || []
  );
  const [selectedFormats, setSelectedFormats] = useState<string[]>(
    preferences.preferredFormats || ['TV Series', 'Movie']
  );
  const [accentColor, setAccentColor] = useState<AtaAccentColor>(
    preferences.accentColor || 'red'
  );
  const [feedDensity, setFeedDensity] = useState<AtaFeedDensity>(
    preferences.feedDensity || 'comfortable'
  );

  if (!isOpen) return null;

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleAnime = (title: string) => {
    setSelectedAnime((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const toggleFormat = (format: string) => {
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
  };

  const handleFinish = async () => {
    try {
      await updatePreferences({
        favouriteGenres: selectedGenres,
        favouriteAnimeTitles: selectedAnime,
        preferredFormats: selectedFormats,
        accentColor,
        feedDensity,
        onboardingCompleted: true,
      });
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setIsOnboardingOpen(false);
      onClose();
    }
  };

  const handleSkipAll = async () => {
    try {
      await updatePreferences({
        onboardingCompleted: true,
      });
    } catch (err) {
      console.error('Failed to skip preferences:', err);
    } finally {
      setIsOnboardingOpen(false);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="px-6 py-4 bg-[#090B14] border-b border-[#303342] flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#EF3038]/20 border border-[#EF3038]/40">
              <Sparkles className="h-4 w-4 text-[#EF3038]" />
            </div>
            <div>
              <p className="font-accent-orbitron text-[10px] font-bold tracking-widest text-[#EF3038] uppercase">
                ATA Personalisation
              </p>
              <h2 id="onboarding-title" className="text-sm font-bold text-white">
                Shape Your Anime Universe
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSkipAll}
            aria-label="Skip onboarding"
            className="text-xs font-semibold text-[#A7A9B8] hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            Skip for now
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="px-6 pt-4 pb-2 bg-[#F4F5F8] dark:bg-[#090B14] border-b border-[#D4D7E2] dark:border-[#303342] flex items-center justify-between">
          <span className="text-xs font-bold text-[#52576B] dark:text-[#A7A9B8]">
            Step {step} of {totalSteps}
          </span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i + 1 === step
                    ? 'w-6 bg-[#EF3038]'
                    : i + 1 < step
                    ? 'w-3 bg-emerald-500'
                    : 'w-3 bg-[#D4D7E2] dark:bg-[#303342]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-[#090B14] dark:text-white">
                  What genres do you enjoy most?
                </h3>
                <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] mt-1">
                  We use your selections to build your personalized &ldquo;For You&rdquo; feed
                  and curate explainable recommendations. Select all that interest you.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {ALL_ANIME_GENRES.map((genre) => {
                  const selected = selectedGenres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        selected
                          ? 'bg-[#EF3038] text-white border-[#B92335] shadow-sm'
                          : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
                      }`}
                    >
                      {genre}
                      {selected && <Check className="h-3 w-3 inline ml-1.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-[#090B14] dark:text-white">
                  Select some favourite anime
                </h3>
                <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] mt-1">
                  Choose titles you love. We’ll show related discussions and recommend
                  hidden gems with similar DNA.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {CURATED_ANIME_CATALOGUE.slice(0, 9).map((anime) => {
                  const selected = selectedAnime.includes(anime.title);
                  return (
                    <button
                      key={anime.id}
                      type="button"
                      onClick={() => toggleAnime(anime.title)}
                      className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                        selected
                          ? 'bg-[#EF3038]/10 border-[#EF3038] ring-1 ring-[#EF3038]'
                          : 'bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342] hover:border-[#090B14] dark:hover:border-white/50'
                      }`}
                    >
                      <div className="aspect-[16/10] w-full rounded-xl overflow-hidden mb-2 relative bg-black/20">
                        <img
                          src={anime.coverImage}
                          alt={anime.title}
                          className="h-full w-full object-cover"
                        />
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-[#EF3038] text-white flex items-center justify-center">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#090B14] dark:text-white line-clamp-1">
                          {anime.title}
                        </p>
                        <p className="text-[10px] text-[#52576B] dark:text-[#A7A9B8]">
                          {anime.format} · {anime.episodes ? `${anime.episodes} eps` : 'Ongoing'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-[#090B14] dark:text-white">
                  Preferred Formats & Release Eras
                </h3>
                <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] mt-1">
                  Tell us what styles of anime you prefer to watch.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-[#090B14] dark:text-white block">
                  Formats
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ANIME_FORMATS.map((format) => {
                    const selected = selectedFormats.includes(format);
                    return (
                      <button
                        key={format}
                        type="button"
                        onClick={() => toggleFormat(format)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          selected
                            ? 'bg-[#EF3038] text-white border-[#B92335]'
                            : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342]'
                        }`}
                      >
                        {format}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-[#090B14] dark:text-white">
                  Appearance & Feed Density
                </h3>
                <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] mt-1">
                  Select your personal accent colour and feed density preference.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-[#090B14] dark:text-white block">
                  Accent Colour
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {(Object.keys(ACCENT_COLOR_MAP) as AtaAccentColor[]).map((key) => {
                    const info = ACCENT_COLOR_MAP[key];
                    const active = accentColor === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setAccentColor(key)}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                          active
                            ? 'border-[#090B14] dark:border-white ring-2 ring-[#EF3038]'
                            : 'border-[#D4D7E2] dark:border-[#303342]'
                        }`}
                      >
                        <span
                          className="h-6 w-6 rounded-full inline-block shadow-inner"
                          style={{ backgroundColor: info.hex }}
                        />
                        <span className="text-[10px] font-semibold text-[#090B14] dark:text-white truncate w-full">
                          {key.toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-[#090B14] dark:text-white block">
                  Feed Density
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFeedDensity('comfortable')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      feedDensity === 'comfortable'
                        ? 'border-[#EF3038] bg-[#EF3038]/5 dark:bg-[#EF3038]/10'
                        : 'border-[#D4D7E2] dark:border-[#303342]'
                    }`}
                  >
                    <p className="text-xs font-bold text-[#090B14] dark:text-white">
                      Comfortable
                    </p>
                    <p className="text-[10px] text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
                      Spacious cards with full previews and generous padding.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedDensity('compact')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      feedDensity === 'compact'
                        ? 'border-[#EF3038] bg-[#EF3038]/5 dark:bg-[#EF3038]/10'
                        : 'border-[#D4D7E2] dark:border-[#303342]'
                    }`}
                  >
                    <p className="text-xs font-bold text-[#090B14] dark:text-white">
                      Compact
                    </p>
                    <p className="text-[10px] text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
                      Higher information density with tighter spacing.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#F4F5F8] dark:bg-[#090B14] border-t border-[#D4D7E2] dark:border-[#303342] flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          ) : (
            <span />
          )}

          {step < totalSteps ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] transition-colors shadow-md"
            >
              <span>Continue</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleFinish()}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] transition-colors shadow-lg"
            >
              <Check className="h-4 w-4" />
              <span>Complete Personalisation</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
