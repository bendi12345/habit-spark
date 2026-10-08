export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_feed: {
        Row: {
          cheers: number
          created_at: string
          id: string
          kind: string
          text: string
          user_id: string
        }
        Insert: {
          cheers?: number
          created_at?: string
          id?: string
          kind: string
          text: string
          user_id: string
        }
        Update: {
          cheers?: number
          created_at?: string
          id?: string
          kind?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          code: string
          description: string
          hidden: boolean
          name: string
          rarity: string
          sort: number
        }
        Insert: {
          category: string
          code: string
          description: string
          hidden?: boolean
          name: string
          rarity: string
          sort?: number
        }
        Update: {
          category?: string
          code?: string
          description?: string
          hidden?: boolean
          name?: string
          rarity?: string
          sort?: number
        }
        Relationships: []
      }
      challenge_attempts: {
        Row: {
          action: string | null
          created_at: string
          field_id: string
          habit_id: string
          id: string
          outcome: string
          user_id: string
        }
        Insert: {
          action?: string | null
          created_at?: string
          field_id: string
          habit_id: string
          id?: string
          outcome: string
          user_id?: string
        }
        Update: {
          action?: string | null
          created_at?: string
          field_id?: string
          habit_id?: string
          id?: string
          outcome?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_attempts_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_attempts_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_rewards: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          price: number
          title: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          price: number
          title: string
          user_id?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          price?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      duel_badges: {
        Row: {
          last_earned: string
          loser: string
          winner: string
          wins: number
        }
        Insert: {
          last_earned?: string
          loser: string
          winner: string
          wins?: number
        }
        Update: {
          last_earned?: string
          loser?: string
          winner?: string
          wins?: number
        }
        Relationships: []
      }
      duel_challenges: {
        Row: {
          completed_at: string | null
          description: string
          duel_id: string
          flagged: boolean
          id: string
          proof: string | null
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          description?: string
          duel_id: string
          flagged?: boolean
          id?: string
          proof?: string | null
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          description?: string
          duel_id?: string
          flagged?: boolean
          id?: string
          proof?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_challenges_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_escrow: {
        Row: {
          amount: number
          duel_id: string
          released: boolean
          user_id: string
        }
        Insert: {
          amount: number
          duel_id: string
          released?: boolean
          user_id: string
        }
        Update: {
          amount?: number
          duel_id?: string
          released?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_escrow_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_results: {
        Row: {
          decided_at: string
          duel_id: string
          loser: string | null
          outcome: string
          pot: number
          winner: string | null
        }
        Insert: {
          decided_at?: string
          duel_id: string
          loser?: string | null
          outcome: string
          pot?: number
          winner?: string | null
        }
        Update: {
          decided_at?: string
          duel_id?: string
          loser?: string | null
          outcome?: string
          pot?: number
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duel_results_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: true
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          awaiting: string | null
          challenger: string
          created_at: string
          duration_days: number
          ends_at: string | null
          id: string
          opponent: string
          stake: number
          starts_at: string | null
          status: string
          target_difficulty: number
        }
        Insert: {
          awaiting?: string | null
          challenger: string
          created_at?: string
          duration_days: number
          ends_at?: string | null
          id?: string
          opponent: string
          stake?: number
          starts_at?: string | null
          status?: string
          target_difficulty: number
        }
        Update: {
          awaiting?: string | null
          challenger?: string
          created_at?: string
          duration_days?: number
          ends_at?: string | null
          id?: string
          opponent?: string
          stake?: number
          starts_at?: string | null
          status?: string
          target_difficulty?: number
        }
        Relationships: []
      }
      feed_cheers: {
        Row: {
          emoji: string
          feed_id: string
          user_id: string
        }
        Insert: {
          emoji?: string
          feed_id: string
          user_id: string
        }
        Update: {
          emoji?: string
          feed_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_cheers_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "activity_feed"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          created_at: string
          description: string
          difficulty: number
          habit_id: string
          id: string
          is_checkpoint: boolean
          position: number
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          difficulty: number
          habit_id: string
          id?: string
          is_checkpoint?: boolean
          position: number
          status?: string
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: number
          habit_id?: string
          id?: string
          is_checkpoint?: boolean
          position?: number
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fields_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee: string
          created_at: string
          id: string
          requester: string
          status: string
        }
        Insert: {
          addressee: string
          created_at?: string
          id?: string
          requester: string
          status?: string
        }
        Update: {
          addressee?: string
          created_at?: string
          id?: string
          requester?: string
          status?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          owner: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner?: string
        }
        Relationships: []
      }
      growth_programs: {
        Row: {
          code: string
          description: string
          emoji: string
          name: string
          price: number
        }
        Insert: {
          code: string
          description: string
          emoji: string
          name: string
          price: number
        }
        Update: {
          code?: string
          description?: string
          emoji?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      habits: {
        Row: {
          ai_interpretation: string | null
          consecutive_failures: number
          created_at: string
          current_position: number
          emoji: string
          free_text: string | null
          goal: string | null
          habit_key: string
          id: string
          intensity: number
          last_checkpoint: number
          name: string
          paused_until: string | null
          user_id: string
        }
        Insert: {
          ai_interpretation?: string | null
          consecutive_failures?: number
          created_at?: string
          current_position?: number
          emoji?: string
          free_text?: string | null
          goal?: string | null
          habit_key?: string
          id?: string
          intensity?: number
          last_checkpoint?: number
          name: string
          paused_until?: string | null
          user_id?: string
        }
        Update: {
          ai_interpretation?: string | null
          consecutive_failures?: number
          created_at?: string
          current_position?: number
          emoji?: string
          free_text?: string | null
          goal?: string | null
          habit_key?: string
          id?: string
          intensity?: number
          last_checkpoint?: number
          name?: string
          paused_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          invite_code: string | null
          pinned_badges: string[]
          szikra: number
          username: string | null
          xp: number
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          invite_code?: string | null
          pinned_badges?: string[]
          szikra?: number
          username?: string | null
          xp?: number
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          invite_code?: string | null
          pinned_badges?: string[]
          szikra?: number
          username?: string | null
          xp?: number
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          category: string
          code: string
          description: string
          emoji: string
          monthly_limit: number | null
          name: string
          price: number
          sort: number
        }
        Insert: {
          category: string
          code: string
          description: string
          emoji?: string
          monthly_limit?: number | null
          name: string
          price: number
          sort?: number
        }
        Update: {
          category?: string
          code?: string
          description?: string
          emoji?: string
          monthly_limit?: number | null
          name?: string
          price?: number
          sort?: number
        }
        Relationships: []
      }
      szikra_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          reason: string
          user_id: string
          xp: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind?: string
          reason: string
          user_id: string
          xp?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          reason?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_code: string
          count: number
          earned_at: string
          id: string
          label: string | null
          user_id: string
        }
        Insert: {
          badge_code: string
          count?: number
          earned_at?: string
          id?: string
          label?: string | null
          user_id: string
        }
        Update: {
          badge_code?: string
          count?: number
          earned_at?: string
          id?: string
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_items: {
        Row: {
          id: string
          item_code: string
          purchased_at: string
          used: boolean
          user_id: string
        }
        Insert: {
          id?: string
          item_code: string
          purchased_at?: string
          used?: boolean
          user_id: string
        }
        Update: {
          id?: string
          item_code?: string
          purchased_at?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _award_badge: {
        Args: { _code: string; _label?: string; _u: string }
        Returns: boolean
      }
      _grant: {
        Args: {
          _kind?: string
          _reason: string
          _szikra: number
          _u: string
          _xp: number
        }
        Returns: undefined
      }
      _settle_duel: {
        Args: { _duel: string; _winner: string }
        Returns: undefined
      }
      accept_duel: { Args: { _duel: string }; Returns: Json }
      add_friend: { Args: { _handle: string }; Returns: Json }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      buy_item: { Args: { _code: string }; Returns: Json }
      cheer: { Args: { _feed: string }; Returns: undefined }
      complete_duel_challenge: {
        Args: { _duel: string; _proof: string }
        Returns: Json
      }
      complete_field: { Args: { _habit: string }; Returns: Json }
      counter_duel: {
        Args: { _duel: string; _stake: number }
        Returns: undefined
      }
      create_duel: {
        Args: {
          _days: number
          _difficulty: number
          _opponent: string
          _stake: number
        }
        Returns: string
      }
      create_group: { Args: { _name: string }; Returns: string }
      decline_duel: { Args: { _duel: string }; Returns: undefined }
      expire_duel: { Args: { _duel: string }; Returns: undefined }
      fail_field: { Args: { _action: string; _habit: string }; Returns: Json }
      flag_duel_proof: { Args: { _duel: string }; Returns: undefined }
      forfeit_duel: { Args: { _duel: string }; Returns: undefined }
      friend_list: {
        Args: never
        Returns: {
          display_name: string
          friendship_id: string
          incoming: boolean
          level: number
          pinned_badges: string[]
          status: string
          streak: number
          user_id: string
          username: string
        }[]
      }
      group_feed: {
        Args: { _g: string }
        Returns: {
          cheered: boolean
          cheers: number
          created_at: string
          id: string
          text: string
          username: string
        }[]
      }
      group_leaderboard: {
        Args: { _g: string }
        Returns: {
          fields_done: number
          level: number
          score: number
          streak: number
          user_id: string
          username: string
        }[]
      }
      group_streak: { Args: { _g: string }; Returns: number }
      is_duelist: { Args: { _d: string; _u: string }; Returns: boolean }
      is_group_member: { Args: { _g: string; _u: string }; Returns: boolean }
      join_group: { Args: { _code: string }; Returns: string }
      my_duels: {
        Args: never
        Returns: {
          awaiting_me: boolean
          created_at: string
          duration_days: number
          ends_at: string
          i_challenged: boolean
          i_won: boolean
          id: string
          my_desc: string
          my_done: boolean
          my_title: string
          other_id: string
          other_name: string
          outcome: string
          pot: number
          stake: number
          status: string
          target_difficulty: number
          their_done: boolean
          their_flagged: boolean
          their_title: string
        }[]
      }
      redeem_reward: { Args: { _id: string }; Returns: Json }
      respond_friend: {
        Args: { _accept: boolean; _id: string }
        Returns: undefined
      }
      reward_for: {
        Args: { _checkpoint: boolean; _difficulty: number }
        Returns: Json
      }
      set_pinned_badges: { Args: { _codes: string[] }; Returns: undefined }
      stake_cap: { Args: { _a: string; _b: string }; Returns: number }
      user_streak: { Args: { _u: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
