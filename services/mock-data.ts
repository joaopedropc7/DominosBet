import type { ProfileStats, QuickMatch, RoomPreview, WalletActivity } from '@/types/app';

export const userMock = {
  name: 'Vini_Master_7',
  shortName: 'MestreX',
  rank: 'Lendário',
  balance: 1250,
  walletBalance: 2450,
};

export const quickModesMock: QuickMatch[] = [
  {
    id: 'duelo',
    title: 'Jogar 1x1',
    subtitle: 'Duelo de elite',
    playersLabel: '2 jogadores',
    entry: 50,
    reward: 90,
    icon: 'sword-cross',
    accent: 'gold',
  },
  {
    id: 'quatro',
    title: 'Jogar 4P',
    subtitle: 'Todos contra todos',
    playersLabel: '4 jogadores',
    entry: 200,
    reward: 750,
    icon: 'account-group-outline',
    accent: 'cyan',
  },
];

export const quickMatchesMock: QuickMatch[] = [
  {
    id: 'iniciante',
    title: 'Mesa Iniciante',
    subtitle: '2 Players • Entrada: 50',
    playersLabel: 'Premiação',
    entry: 50,
    reward: 90,
    icon: 'domino-mask',
    accent: 'gold',
  },
  {
    id: 'turbo',
    title: 'Modo Turbo',
    subtitle: '4 Players • Entrada: 200',
    playersLabel: 'Premiação',
    entry: 200,
    reward: 750,
    icon: 'lightning-bolt',
    accent: 'cyan',
  },
];

export const roomPreviewsMock: RoomPreview[] = [
  {
    id: 'padrinho',
    badge: 'High Stakes',
    title: 'Mesa do Padrinho',
    description: 'Aguardando mais um jogador...',
    buyIn: 1000,
    actionLabel: 'Entrar',
  },
  {
    id: 'elite',
    badge: 'Torneio',
    title: 'Elite Royale',
    description: 'Mesa cheia • Assistindo agora',
    buyIn: 5000,
    actionLabel: 'Espectador',
  },
];

export const selectionModesMock = [
  {
    id: 'mode-1x1',
    eyebrow: 'Modo competitivo',
    title: '1x1 (Duelo)',
    status: 'LIVE',
    entry: 100,
    reward: 180,
    players: '1/2',
  },
  {
    id: 'mode-4p',
    eyebrow: 'Clássico',
    title: '4 Jogadores',
    status: 'Mesa cheia',
    entry: 100,
    reward: 360,
    players: '2/4',
  },
];

export const matchmakingPlayersMock = [
  { id: 'self', name: 'MestreX', status: 'Você' },
  { id: 'p2', name: 'CyberDom', status: 'Encontrado' },
  { id: 'p3', name: 'Buscando...', status: 'pending' },
  { id: 'p4', name: 'Buscando...', status: 'pending' },
];

export const profileStatsMock: ProfileStats = {
  level: 42,
  xp: 2450,
  xpTarget: 3000,
  winRate: 65,
  matches: 142,
  streak: '5 vitórias',
};

export const walletActivityMock: WalletActivity[] = [
  {
    id: 'w1',
    title: 'Vitória',
    description: 'Partida #8821',
    value: 180,
    highlight: 'gold',
    timeLabel: '14:30',
  },
  {
    id: 'w2',
    title: 'Entrada',
    description: 'Buy-in Torneio',
    value: -100,
    highlight: 'muted',
    timeLabel: '12:15',
  },
  {
    id: 'w3',
    title: 'Recarga',
    description: 'PIX Transferência',
    value: 500,
    highlight: 'cyan',
    timeLabel: 'Ontem',
  },
];

export const resultMock = {
  reward: 180,
  time: '04:22',
  points: 150,
  opponent: 'Carlos_Dom10',
  opponentScore: 85,
};
