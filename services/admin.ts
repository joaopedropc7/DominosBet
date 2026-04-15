import { supabase } from '@/services/supabase';
import type { AdminDashboardData, AffiliateLinkRow, ProfileRow } from '@/types/database';

export async function adminGetDashboard(): Promise<AdminDashboardData> {
  const { data, error } = await supabase.rpc('admin_get_dashboard');
  if (error) throw error;
  return data as AdminDashboardData;
}

export async function adminListUsers(
  searchTerm = '',
  pageOffset = 0,
  pageLimit = 50,
): Promise<ProfileRow[]> {
  const { data, error } = await supabase.rpc('admin_list_users', {
    search_term: searchTerm,
    page_offset: pageOffset,
    page_limit: pageLimit,
  });
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export async function adminAdjustBalance(
  targetUserId: string,
  amount: number,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_adjust_balance', {
    target_user_id: targetUserId,
    amount,
    reason,
  });
  if (error) throw error;
}

export async function adminSetBan(targetUserId: string, ban: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_ban', {
    target_user_id: targetUserId,
    ban,
  });
  if (error) throw error;
}

export async function adminListAffiliateLinks(): Promise<AffiliateLinkRow[]> {
  const { data, error } = await supabase.rpc('admin_list_affiliate_links');
  if (error) throw error;
  return (data ?? []) as AffiliateLinkRow[];
}

export async function adminCreateAffiliateLink(
  code: string,
  label: string,
  bonus: number,
): Promise<string> {
  const { data, error } = await supabase.rpc('admin_create_affiliate_link', {
    link_code: code,
    link_label: label,
    bonus,
  });
  if (error) throw error;
  return data as string;
}

export async function adminToggleAffiliateLink(linkId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_toggle_affiliate_link', {
    link_id: linkId,
    active,
  });
  if (error) throw error;
}
