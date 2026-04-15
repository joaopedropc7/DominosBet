import type { BottomNavItem } from '@/types/app';

export const APP_NAME = 'Dominos Bet';
export const APP_TAGLINE = 'The Underground Arena';

// Central route metadata keeps bottom navigation and future deep links aligned.
export const bottomNavItems: BottomNavItem[] = [
  { label: 'Início', icon: 'home-variant', href: '/(main)/home', matchers: ['/home', '/(main)/home'] },
  { label: 'Carteira', icon: 'wallet-outline', href: '/(main)/carteira', matchers: ['/carteira', '/(main)/carteira'] },
  { label: 'Perfil', icon: 'account-outline', href: '/(main)/perfil', matchers: ['/perfil', '/(main)/perfil', '/editar-perfil', '/(main)/editar-perfil'] },
  { label: 'Alertas', icon: 'bell-outline', href: '/(main)/resultado', matchers: ['/resultado', '/(main)/resultado'] },
];
