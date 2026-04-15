import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';

/**
 * Chama is_admin() diretamente no banco (security definer, sem cache),
 * garantindo o valor real independente do estado do UserDataProvider.
 */
export function useAdminGuard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase
      .rpc('is_admin')
      .then(({ data }) => {
        setIsAdmin(data === true);
      })
      .catch(() => {
        setIsAdmin(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAdmin) {
      router.replace('/home');
    }
  }, [isLoading, isAdmin]);

  return { isAdmin, isLoading };
}
