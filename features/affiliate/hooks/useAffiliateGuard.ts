import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';

export type AffiliateProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  status: 'pending' | 'approved' | 'rejected';
  own_code: string | null;
  referral_code: string | null;
  revshare_percent: number;
  cpa_amount: number;
  sub_affiliate_percent: number;
  pix_key_type: string | null;
  pix_key: string | null;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
};

export function useAffiliateGuard() {
  const { session, isLoading: authLoading } = useAuth();
  const [affiliate, setAffiliate] = useState<AffiliateProfile | null>(null);
  const [isLoading, setIsLoading]  = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.replace('/login'); return; }

    supabase.rpc('get_my_affiliate_profile').then(({ data, error }) => {
      if (error || !data) {
        // Not an affiliate yet — send to registration
        router.replace('/seja-afiliado');
        return;
      }
      setAffiliate(data as AffiliateProfile);
      setIsLoading(false);
    });
  }, [authLoading, session]);

  function refreshAffiliate() {
    supabase.rpc('get_my_affiliate_profile').then(({ data }) => {
      if (data) setAffiliate(data as AffiliateProfile);
    });
  }

  return { affiliate, isLoading: authLoading || isLoading, refreshAffiliate };
}
