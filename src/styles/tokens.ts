export const ATA_COLORS = {
  spaceBlack: '#090B14',
  darkSurface: '#171923',
  pureWhite: '#FFFFFF',
  ataRed: '#EF3038',
  deepRed: '#B92335',
  softGrey: '#A7A9B8',
  borderGrey: '#303342',
  // Light-mode neutral surfaces
  lightCanvas: '#F4F5F8',
  lightSurfaceAlt: '#EAECEF',
  lightBorder: '#D4D7E2',
  lightMutedText: '#52576B',
} as const;

export const ATA_SURFACES = {
  card: 'bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-xl',
  cardElevated:
    'bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl shadow-sm dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)]',
  cardSubtle:
    'bg-[#F4F5F8] dark:bg-[#090B14]/70 border border-[#D4D7E2] dark:border-[#303342] rounded-xl',
  primaryButton:
    'bg-[#EF3038] text-white border border-[#B92335] hover:bg-[#B92335] transition-colors duration-150 rounded-lg font-semibold',
  secondaryButton:
    'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] dark:hover:border-[#EF3038] transition-colors duration-150 rounded-lg font-semibold',
} as const;
