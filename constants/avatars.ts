import type { IconName } from '@/types/app';

export interface AvatarOption {
  id: string;
  name: string;
  icon: IconName;
  colors: [string, string];
}

export const avatarOptions: AvatarOption[] = [
  { id: 'gold-striker', name: 'Gold Striker', icon: 'shield-sword-outline', colors: ['#F2CA50', '#7A5A12'] },
  { id: 'cyber-dom', name: 'Cyber Dom', icon: 'robot-outline', colors: ['#00E4F1', '#083C43'] },
  { id: 'night-club', name: 'Night Club', icon: 'cards-outline', colors: ['#474746', '#141414'] },
  { id: 'arena-king', name: 'Arena King', icon: 'crown-outline', colors: ['#F2CA50', '#2C2207'] },
  { id: 'neon-rival', name: 'Neon Rival', icon: 'lightning-bolt-outline', colors: ['#00E4F1', '#132A2C'] },
  { id: 'classic-pro', name: 'Classic Pro', icon: 'account-star-outline', colors: ['#5A5A5A', '#202020'] },
];

export const defaultAvatarId = avatarOptions[0].id;

export function getAvatarOption(avatarId?: string | null) {
  return avatarOptions.find((item) => item.id === avatarId) ?? avatarOptions[0];
}
