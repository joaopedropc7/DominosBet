import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import { countUnreadNotifications } from '@/services/notifications';
import { useAuth } from '@/hooks/useAuth';

/** Returns the live count of unread notifications for the current user. */
export function useUnreadNotifications(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  // Unique ID per hook instance — prevents channel-name collision when
  // the component remounts while the old channel is still being removed.
  const instanceId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!user) { setCount(0); return; }

    let active = true;

    // Initial fetch
    countUnreadNotifications().then((n) => { if (active) setCount(n); }).catch(() => {});

    const channel = supabase
      .channel(`unread_notifs:${user.id}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          if (active) countUnreadNotifications().then((n) => { if (active) setCount(n); }).catch(() => {});
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id, instanceId]);

  return count;
}
