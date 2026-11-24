import type { UserAnimeListItem, WatchJourneyMilestone } from '../../types';

export function calculateWatchJourneyMilestones(items: UserAnimeListItem[]): WatchJourneyMilestone[] {
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const totalEpisodes = items.reduce((sum, i) => sum + (i.episodesWatched || 0), 0);
  const ratedCount = items.filter((i) => typeof i.userRating === 'number' && i.userRating > 0).length;
  const genresSet = new Set<string>();
  items.forEach((i) => {
    (i.genres || []).forEach((g) => genresSet.add(g));
  });

  return [
    {
      id: 'first_anime',
      title: 'First Step into the Universe',
      description: 'Add your first anime series to your personal watch tracker.',
      icon: '🚀',
      achieved: items.length > 0,
      progressText: items.length > 0 ? 'Completed' : '0 / 1 series',
    },
    {
      id: 'marathoner',
      title: 'Dedicated Watcher',
      description: 'Complete 5 anime series in your watchlist.',
      icon: '🎬',
      achieved: completedCount >= 5,
      progressText: `${Math.min(completedCount, 5)} / 5 completed`,
    },
    {
      id: 'episode_century',
      title: 'Century Club',
      description: 'Watch a cumulative total of 100 anime episodes.',
      icon: '⏱️',
      achieved: totalEpisodes >= 100,
      progressText: `${Math.min(totalEpisodes, 100)} / 100 episodes`,
    },
    {
      id: 'critic',
      title: 'Seasoned Critic',
      description: 'Rate 10 different anime series in your collection.',
      icon: '⭐',
      achieved: ratedCount >= 10,
      progressText: `${Math.min(ratedCount, 10)} / 10 rated`,
    },
    {
      id: 'genre_explorer',
      title: 'Genre Explorer',
      description: 'Track anime across at least 5 different genres.',
      icon: '🗺️',
      achieved: genresSet.size >= 5,
      progressText: `${Math.min(genresSet.size, 5)} / 5 genres`,
    },
  ];
}
