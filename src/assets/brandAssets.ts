export type AtaLogoVariant = 'primary' | 'compact' | 'icon-only' | 'monochrome';
export type AtaLogoSurface =
  | 'auto'
  | 'dark'
  | 'light'
  | 'monochrome-dark'
  | 'monochrome-light';

export interface BrandAssetSpec {
  id: string;
  label: string;
  usage: string;
  variant: AtaLogoVariant | 'favicon' | 'loader';
  assetPath?: string;
}

export const ATA_BRAND_ASSETS: BrandAssetSpec[] = [
  {
    id: 'primary-logo',
    label: 'Primary ATA Logo',
    usage: 'Desktop navigation sidebar, welcome header, and brand lockups.',
    variant: 'primary',
  },
  {
    id: 'compact-logo',
    label: 'Compact ATA Logo',
    usage: 'Mobile top app bar and tight navigation headers.',
    variant: 'compact',
  },
  {
    id: 'cosmic-app-icon',
    label: 'Standalone Cosmic App Icon',
    usage: 'Square emblem without wordmark for app tiles and avatars.',
    variant: 'icon-only',
  },
  {
    id: 'monochrome-logo',
    label: 'Monochrome Logo',
    usage: 'Single-ink watermarks, print headers, and subdued footers.',
    variant: 'monochrome',
  },
  {
    id: 'favicon',
    label: 'Cosmic Portal Favicon',
    usage: 'Browser tab icon and bookmark badge.',
    variant: 'favicon',
    assetPath: `${import.meta.env.BASE_URL}favicon.svg`,
  },
  {
    id: 'loading-animation',
    label: 'Orbital Portal Loader',
    usage: 'Media loading states and async transitions.',
    variant: 'loader',
  },
];
