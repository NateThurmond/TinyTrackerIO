export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          unit_preference: 'ml' | 'oz'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          unit_preference?: 'ml' | 'oz'
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          unit_preference?: 'ml' | 'oz'
          updated_at?: string
        }
        Relationships: []
      }
      babies: {
        Row: {
          id: string
          name: string
          gender: 'male' | 'female' | 'other' | null
          birth_date: string | null
          photo_url: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          gender?: 'male' | 'female' | 'other' | null
          birth_date?: string | null
          photo_url?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          gender?: 'male' | 'female' | 'other' | null
          birth_date?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      baby_caregivers: {
        Row: {
          id: string
          baby_id: string
          user_id: string
          role: 'owner' | 'caregiver'
          created_at: string
        }
        Insert: {
          id?: string
          baby_id: string
          user_id: string
          role?: 'owner' | 'caregiver'
          created_at?: string
        }
        Update: {
          role?: 'owner' | 'caregiver'
        }
        Relationships: [
          {
            foreignKeyName: 'baby_caregivers_baby_id_fkey'
            columns: ['baby_id']
            isOneToOne: false
            referencedRelation: 'babies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'baby_caregivers_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      invites: {
        Row: {
          id: string
          baby_id: string
          email: string
          token: string
          accepted: boolean
          created_by: string
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          baby_id: string
          email: string
          token?: string
          accepted?: boolean
          created_by: string
          created_at?: string
          expires_at?: string
        }
        Update: {
          accepted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'invites_baby_id_fkey'
            columns: ['baby_id']
            isOneToOne: false
            referencedRelation: 'babies'
            referencedColumns: ['id']
          }
        ]
      }
      feedings: {
        Row: {
          id: string
          baby_id: string
          logged_by: string
          amount_ml: number
          notes: string | null
          fed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          baby_id: string
          logged_by: string
          amount_ml: number
          notes?: string | null
          fed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          amount_ml?: number
          notes?: string | null
          fed_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'feedings_baby_id_fkey'
            columns: ['baby_id']
            isOneToOne: false
            referencedRelation: 'babies'
            referencedColumns: ['id']
          }
        ]
      }
      diapers: {
        Row: {
          id: string
          baby_id: string
          logged_by: string
          type: 'pee' | 'poop' | 'mixed'
          size: 'small' | 'med' | 'big' | 'ginormous' | null
          notes: string | null
          changed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          baby_id: string
          logged_by: string
          type: 'pee' | 'poop' | 'mixed'
          size?: 'small' | 'med' | 'big' | 'ginormous' | null
          notes?: string | null
          changed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          type?: 'pee' | 'poop' | 'mixed'
          size?: 'small' | 'med' | 'big' | 'ginormous' | null
          notes?: string | null
          changed_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'diapers_baby_id_fkey'
            columns: ['baby_id']
            isOneToOne: false
            referencedRelation: 'babies'
            referencedColumns: ['id']
          }
        ]
      }
      sleeps: {
        Row: {
          id: string
          baby_id: string
          logged_by: string
          started_at: string
          ended_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          baby_id: string
          logged_by: string
          started_at?: string
          ended_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          started_at?: string
          ended_at?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sleeps_baby_id_fkey'
            columns: ['baby_id']
            isOneToOne: false
            referencedRelation: 'babies'
            referencedColumns: ['id']
          }
        ]
      }
      weights: {
        Row: {
          id: string
          baby_id: string
          logged_by: string
          weight_lbs: number
          notes: string | null
          weighed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          baby_id: string
          logged_by: string
          weight_lbs: number
          notes?: string | null
          weighed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          weight_lbs?: number
          notes?: string | null
          weighed_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'weights_baby_id_fkey'
            columns: ['baby_id']
            isOneToOne: false
            referencedRelation: 'babies'
            referencedColumns: ['id']
          }
        ]
      }
      alarms: {
        Row: {
          id: string
          baby_id: string
          created_by: string
          type: 'feeding' | 'diaper' | 'sleep' | 'custom'
          label: string
          interval_minutes: number | null
          next_due_at: string | null
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          baby_id: string
          created_by: string
          type: 'feeding' | 'diaper' | 'sleep' | 'custom'
          label: string
          interval_minutes?: number | null
          next_due_at?: string | null
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          type?: 'feeding' | 'diaper' | 'sleep' | 'custom'
          label?: string
          interval_minutes?: number | null
          next_due_at?: string | null
          enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'alarms_baby_id_fkey'
            columns: ['baby_id']
            isOneToOne: false
            referencedRelation: 'babies'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Profile = Tables<'profiles'>
export type Baby = Tables<'babies'>
export type BabyCaregiver = Tables<'baby_caregivers'>
export type Feeding = Tables<'feedings'>
export type Diaper = Tables<'diapers'>
export type Sleep = Tables<'sleeps'>
export type Weight = Tables<'weights'>
export type Alarm = Tables<'alarms'>
export type Invite = Tables<'invites'>
