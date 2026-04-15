export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          display_name_updated_at: string | null;
          avatar_id: string;
          rank_label: string;
          balance: number;
          level: number;
          xp: number;
          xp_target: number;
          win_rate: number;
          matches_count: number;
          streak_label: string;
          is_admin: boolean;
          is_banned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          display_name_updated_at?: string | null;
          avatar_id?: string;
          rank_label?: string;
          balance?: number;
          level?: number;
          xp?: number;
          xp_target?: number;
          win_rate?: number;
          matches_count?: number;
          streak_label?: string;
          is_admin?: boolean;
          is_banned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string;
          amount: number;
          highlight: 'gold' | 'cyan' | 'muted';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description: string;
          amount: number;
          highlight?: 'gold' | 'cyan' | 'muted';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['wallet_transactions']['Insert']>;
        Relationships: [];
      };
      match_history: {
        Row: {
          id: string;
          user_id: string;
          room_name: string;
          opponent_name: string;
          result: 'win' | 'loss';
          reward: number;
          score: number;
          opponent_score: number;
          duration_seconds: number;
          is_private: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          room_name: string;
          opponent_name: string;
          result: 'win' | 'loss';
          reward: number;
          score: number;
          opponent_score: number;
          duration_seconds: number;
          is_private?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['match_history']['Insert']>;
        Relationships: [];
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted';
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: 'pending' | 'accepted';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['friendships']['Insert']>;
        Relationships: [];
      };
      affiliate_links: {
        Row: {
          id: string;
          created_by: string;
          code: string;
          label: string;
          bonus_coins: number;
          uses_count: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          created_by: string;
          code: string;
          label?: string;
          bonus_coins?: number;
          uses_count?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['affiliate_links']['Insert']>;
        Relationships: [];
      };
      affiliate_uses: {
        Row: {
          id: string;
          link_id: string;
          used_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          link_id: string;
          used_by: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['affiliate_uses']['Insert']>;
        Relationships: [];
      };
      match_rooms: {
        Row: {
          id: string;
          status: 'waiting' | 'playing' | 'finished';
          mode: 'classic' | 'express';
          player1_id: string;
          player2_id: string | null;
          current_turn_id: string | null;
          game_state: OnlineGameState | Record<string, never>;
          winner_id: string | null;
          entry_fee: number;
          pot: number;
          bet_placed: boolean;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          status?: 'waiting' | 'playing' | 'finished';
          mode?: 'classic' | 'express';
          player1_id: string;
          player2_id?: string | null;
          current_turn_id?: string | null;
          game_state?: OnlineGameState | Record<string, never>;
          winner_id?: string | null;
          entry_fee?: number;
          pot?: number;
          bet_placed?: boolean;
          started_at?: string | null;
          finished_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['match_rooms']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      increment_profile_after_victory: {
        Args: { target_user_id: string; reward_amount: number };
        Returns: undefined;
      };
      update_profile_identity: {
        Args: { target_display_name: string; target_avatar_id: string };
        Returns: undefined;
      };
      find_profile_by_nickname: {
        Args: { nickname: string };
        Returns: Database['public']['Tables']['profiles']['Row'][];
      };
      admin_get_dashboard: {
        Args: Record<string, never>;
        Returns: AdminDashboardData;
      };
      admin_list_users: {
        Args: { search_term?: string; page_offset?: number; page_limit?: number };
        Returns: Database['public']['Tables']['profiles']['Row'][];
      };
      admin_adjust_balance: {
        Args: { target_user_id: string; amount: number; reason: string };
        Returns: undefined;
      };
      admin_set_ban: {
        Args: { target_user_id: string; ban: boolean };
        Returns: undefined;
      };
      admin_create_affiliate_link: {
        Args: { link_code: string; link_label?: string; bonus?: number };
        Returns: string;
      };
      admin_list_affiliate_links: {
        Args: Record<string, never>;
        Returns: AffiliateLinkRow[];
      };
      admin_toggle_affiliate_link: {
        Args: { link_id: string; active: boolean };
        Returns: undefined;
      };
      join_matchmaking: {
        Args: Record<string, never>;
        Returns: { room_id: string; role: 'p1' | 'p2' };
      };
      start_online_match: {
        Args: { room_id: string; initial_state: OnlineGameState; first_turn_id: string };
        Returns: undefined;
      };
      make_move_online: {
        Args: { room_id: string; new_state: OnlineGameState; flip_turn?: boolean };
        Returns: undefined;
      };
      abandon_match: {
        Args: { room_id: string };
        Returns: undefined;
      };
      leave_matchmaking: {
        Args: { room_id: string };
        Returns: undefined;
      };
      resolve_online_match: {
        Args: { room_id: string; winner_id: string | null; duration_seconds: number; p1_pips: number; p2_pips: number };
        Returns: { winner_reward: number; loser_reward: number };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ── Online multiplayer types ──────────────────────────────────────────────────

export type OnlinePlayerId = 'p1' | 'p2';

export interface OnlineTile {
  id: string;
  left: number;
  right: number;
}

export interface OnlinePlayedTile extends OnlineTile {
  sourceId: string;
}

export interface OnlineResult {
  winner: OnlinePlayerId | 'draw';
  reason: 'empty-hand' | 'blocked' | 'abandoned';
  p1Pips: number;
  p2Pips: number;
}

export interface OnlineLogEntry {
  id: string;
  message: string;
}

/** Serialised shape stored in match_rooms.game_state JSONB */
export interface OnlineGameState {
  p1Id: string;
  p2Id: string;
  p1Name: string;
  p2Name: string;
  p1Hand: OnlineTile[];
  p2Hand: OnlineTile[];
  board: OnlinePlayedTile[];
  boneyard: OnlineTile[];
  currentTurn: OnlinePlayerId;
  consecutivePasses: number;
  status: 'playing' | 'finished';
  result: OnlineResult | null;
  turn: number;
  log: OnlineLogEntry[];
  mode: 'classic' | 'express';
}

// ─────────────────────────────────────────────────────────────────────────────

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type WalletTransactionRow = Database['public']['Tables']['wallet_transactions']['Row'];
export type MatchHistoryRow = Database['public']['Tables']['match_history']['Row'];
export type FriendshipRow = Database['public']['Tables']['friendships']['Row'];

export type AffiliateLinkRow = {
  id: string;
  code: string;
  label: string;
  bonus_coins: number;
  uses_count: number;
  is_active: boolean;
  created_at: string;
  creator_name: string;
};

export type AdminDashboardData = {
  total_users: number;
  total_matches: number;
  total_coins: number;
  new_users_today: number;
  new_users_week: number;
  total_affiliates: number;
  affiliate_uses: number;
};

export type MatchRoomRow = Database['public']['Tables']['match_rooms']['Row'];

export interface NotificationRow {
  id: string;
  user_id: string;
  type: 'room_invite';
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface FriendEntry {
  friendshipId: string;
  profile: ProfileRow;
  status: 'accepted' | 'pending_sent' | 'pending_received';
  createdAt: string;
}
