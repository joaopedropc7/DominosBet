import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type NavRoute = '/(main)/home' | '/(main)/salas' | '/(main)/carteira' | '/(main)/perfil' | '/(main)/resultado';

export interface BottomNavItem {
  label: string;
  icon: IconName;
  href: NavRoute;
  matchers: string[];
}

export interface QuickMatch {
  id: string;
  title: string;
  subtitle: string;
  playersLabel: string;
  entry: number;
  reward: number;
  icon: IconName;
  accent?: 'gold' | 'cyan';
}

export interface RoomPreview {
  id: string;
  badge: string;
  title: string;
  description: string;
  buyIn: number;
  actionLabel: string;
}

export interface WalletActivity {
  id: string;
  title: string;
  description: string;
  value: number;
  highlight: 'gold' | 'cyan' | 'muted';
  timeLabel: string;
}

export interface ProfileStats {
  level: number;
  xp: number;
  xpTarget: number;
  winRate: number;
  matches: number;
  streak: string;
}
