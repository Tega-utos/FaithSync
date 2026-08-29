export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type DisciplineType = 'prayer' | 'word' | 'meditation' | 'fasting' | 'study'
export type BuddyStatus = 'pending' | 'accepted' | 'declined' | 'blocked'
export type MessageType = 'text' | 'nudge' | 'verse_share'

export interface UserPreferences {
  targets?: {
    prayer_minutes?: number
    word_minutes?: number
    meditation_minutes?: number
    fasting_hours?: number
    study_minutes?: number
  }
  prayerTarget?: number
  studyTarget?: number
  church?: string
  bio?: string
  theme?: 'dark' | 'light' | 'system'
  notifications_enabled?: boolean
  daily_reminder_time?: string
  publicStreak?: boolean
  publicMilestones?: boolean
  [key: string]: any
}

export interface BuddyPermissions {
  shareHistory?: boolean
  allowNudge?: boolean
  shareLiveSession?: boolean
  canInviteToClockIn?: boolean
  sendNotificationOnStart?: boolean
  canViewDetailedHistory?: boolean
  [key: string]: any
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          church?: string | null
          buddy_code: string
          preferred_bible_version?: string | null
          preferences: UserPreferences
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          church?: string | null
          buddy_code?: string
          preferred_bible_version?: string | null
          preferences?: UserPreferences
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          church?: string | null
          buddy_code?: string
          preferred_bible_version?: string | null
          preferences?: UserPreferences
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          type: DisciplineType
          duration_seconds: number
          target_duration_seconds: number | null
          is_complete: boolean
          reflection: string | null
          verse_reference: string | null
          shared_to_square: boolean
          focus_type?: string | null
          focus_timeline?: Json | null
          started_at: string
          ended_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: DisciplineType
          duration_seconds: number
          target_duration_seconds?: number | null
          is_complete?: boolean
          reflection?: string | null
          verse_reference?: string | null
          shared_to_square?: boolean
          focus_type?: string | null
          focus_timeline?: Json | null
          started_at?: string
          ended_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: DisciplineType
          duration_seconds?: number
          target_duration_seconds?: number | null
          is_complete?: boolean
          reflection?: string | null
          verse_reference?: string | null
          shared_to_square?: boolean
          focus_type?: string | null
          focus_timeline?: Json | null
          started_at?: string
          ended_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      buddies: {
        Row: {
          id: string
          user_id: string
          buddy_id: string
          status: BuddyStatus
          permissions: BuddyPermissions
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          buddy_id: string
          status?: BuddyStatus
          permissions?: BuddyPermissions
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          buddy_id?: string
          status?: BuddyStatus
          permissions?: BuddyPermissions
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'buddies_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'buddies_buddy_id_fkey'
            columns: ['buddy_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      buddy_chats: {
        Row: {
          id: string
          buddy_connection_id: string
          created_at: string
          last_message_at: string
        }
        Insert: {
          id?: string
          buddy_connection_id: string
          created_at?: string
          last_message_at?: string
        }
        Update: {
          id?: string
          buddy_connection_id?: string
          created_at?: string
          last_message_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string
          content: string
          message_type: MessageType | string
          meta?: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          sender_id: string
          content: string
          message_type?: MessageType | string
          meta?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          sender_id?: string
          content?: string
          message_type?: MessageType | string
          meta?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      square_posts: {
        Row: {
          id: string
          user_id: string
          session_id: string | null
          content: string
          verse_reference: string | null
          scripture_reference?: string | null
          scripture_version_id?: string | null
          post_type: string
          is_anonymous?: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id?: string | null
          content: string
          verse_reference?: string | null
          scripture_reference?: string | null
          scripture_version_id?: string | null
          post_type?: string
          is_anonymous?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string | null
          content?: string
          verse_reference?: string | null
          scripture_reference?: string | null
          scripture_version_id?: string | null
          post_type?: string
          is_anonymous?: boolean | null
          created_at?: string
        }
        Relationships: []
      }
      square_reactions: {
        Row: {
          id: string
          post_id: string
          user_id: string
          reaction_type: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          reaction_type: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          reaction_type?: string
          created_at?: string
        }
        Relationships: []
      }
      square_comments: {
        Row: {
          id: string
          post_id: string
          user_id: string
          content: string
          is_anonymous?: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          content: string
          is_anonymous?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          content?: string
          is_anonymous?: boolean | null
          created_at?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          id: string
          post_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      groups: {
        Row: {
          id: string
          name: string
          category: string
          church: string | null
          code?: string | null
          guidelines: string | null
          avatar_url: string | null
          is_private: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          church?: string | null
          code?: string | null
          guidelines?: string | null
          avatar_url?: string | null
          is_private?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          church?: string | null
          code?: string | null
          guidelines?: string | null
          avatar_url?: string | null
          is_private?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
        Relationships: []
      }
      group_messages: {
        Row: {
          id: string
          group_id: string
          sender_id: string
          content: string
          message_type: string
          meta: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          sender_id: string
          content: string
          message_type?: string
          meta?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          sender_id?: string
          content?: string
          message_type?: string
          meta?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      live_rooms: {
        Row: {
          id: string
          room_id: string
          group_id: string | null
          host_id: string
          discipline: 'prayer' | 'study'
          target_mins: number
          focus_text: string | null
          is_active: boolean
          started_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          room_id: string
          group_id?: string | null
          host_id: string
          discipline: 'prayer' | 'study'
          target_mins?: number
          focus_text?: string | null
          is_active?: boolean
          started_at?: string
          ended_at?: string | null
        }
        Update: {
          id?: string
          room_id?: string
          group_id?: string | null
          host_id?: string
          discipline?: 'prayer' | 'study'
          target_mins?: number
          focus_text?: string | null
          is_active?: boolean
          started_at?: string
          ended_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          text: string
          icon_type: string | null
          read: boolean
          route_url?: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          text: string
          icon_type?: string | null
          read?: boolean
          route_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          text?: string
          icon_type?: string | null
          read?: boolean
          route_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      prayer_focus_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          segments: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          segments: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          segments?: Json
          created_at?: string
        }
        Relationships: []
      }
      scripture_cache: {
        Row: {
          reference: string
          version_id: string
          text: string
          cached_at: string
        }
        Insert: {
          reference: string
          version_id: string
          text: string
          cached_at?: string
        }
        Update: {
          reference?: string
          version_id?: string
          text?: string
          cached_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_streak: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_milestones: {
        Args: { p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      discipline_type: DisciplineType
      buddy_status: BuddyStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
