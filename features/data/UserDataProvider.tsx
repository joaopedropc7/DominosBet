import type { PropsWithChildren } from 'react';
import { createContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  ensureUserProfile,
  getUserProfile,
  listMatchHistory,
  listWalletTransactions,
  saveDemoMatchResult,
  seedUserDataIfNeeded,
  updateUserProfile,
} from '@/services/user-data';
import type { MatchHistoryRow, ProfileRow, WalletTransactionRow } from '@/types/database';

interface UserDataContextValue {
  profile: ProfileRow | null;
  walletTransactions: WalletTransactionRow[];
  matchHistory: MatchHistoryRow[];
  isLoading: boolean;
  errorMessage: string;
  refresh: () => Promise<void>;
  recordDemoResult: () => Promise<void>;
  updateProfile: (payload: { display_name: string; avatar_id: string }) => Promise<void>;
}

export const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: PropsWithChildren) {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionRow[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function refresh() {
    if (!user || !session) {
      setProfile(null);
      setWalletTransactions([]);
      setMatchHistory([]);
      setErrorMessage('');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');

      await ensureUserProfile(user.id, user.email, user.user_metadata?.display_name);
      await seedUserDataIfNeeded(user.id);

      const [profileData, walletData, matchData] = await Promise.all([
        getUserProfile(user.id),
        listWalletTransactions(user.id),
        listMatchHistory(user.id),
      ]);

      setProfile(profileData);
      setWalletTransactions(walletData);
      setMatchHistory(matchData);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível carregar os dados do usuário no Supabase.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function recordDemoResult() {
    if (!user) return;
    await saveDemoMatchResult(user.id);
    await refresh();
  }

  async function updateProfile(payload: { display_name: string; avatar_id: string }) {
    if (!user) return;
    await updateUserProfile(payload);
    await refresh();
  }

  useEffect(() => {
    refresh();
  }, [session?.access_token, user?.id]);

  const value = useMemo(
    () => ({
      profile,
      walletTransactions,
      matchHistory,
      isLoading,
      errorMessage,
      refresh,
      recordDemoResult,
      updateProfile,
    }),
    [errorMessage, isLoading, matchHistory, profile, walletTransactions],
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}
