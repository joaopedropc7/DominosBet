import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { countUnreadNotifications } from '@/services/notifications';
import { useAuth } from '@/hooks/useAuth';

/** Returns the live count of unread notifications for the current user. */
export function useUnreadNotifications(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }

    // Initial fetch
    countUnreadNotifications().then(setCount).catch(() => {});

    // Subscribe to inserts/updates on the notifications table for this user
    const channel = supabase
      .channel(`unread_notifs:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { countUnreadNotifications().then(setCount).catch(() => {}); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return count;
}
