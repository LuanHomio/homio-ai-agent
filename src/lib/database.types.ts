// AUTO-GENERATED — do not edit by hand.
// Regenerate via MCP `mcp__supabase-homio-ai-agent__generate_typescript_types`
// ou via CLI: `npx supabase gen types typescript --project-id wjuigblcflvwmybmrldq > src/lib/database.types.ts`
//
// O Supabase project `wjuigblcflvwmybmrldq` e compartilhado entre Homio AI Agent,
// Floracred, Elegant Stones e Meu Guia. Os types abaixo refletem TODAS as tabelas
// do schema public — algumas (call_evaluations, destination_guides, travel_*, etc)
// pertencem a outros produtos. Nao mexer nelas a partir deste projeto.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agency_token: {
        Row: {
          access_token: string
          app_client_id: string | null
          app_name: string | null
          created_at: string | null
          expires_at: string
          id: number
          key: string
          refresh_token: string
        }
        Insert: {
          access_token: string
          app_client_id?: string | null
          app_name?: string | null
          created_at?: string | null
          expires_at: string
          id?: number
          key: string
          refresh_token: string
        }
        Update: {
          access_token?: string
          app_client_id?: string | null
          app_name?: string | null
          created_at?: string | null
          expires_at?: string
          id?: number
          key?: string
          refresh_token?: string
        }
        Relationships: []
      }
      agent_actions: {
        Row: {
          action_type: string
          agent_id: string
          config: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          action_type: string
          agent_id: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          action_type?: string
          agent_id?: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_knowledge_bases: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          knowledge_base_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          knowledge_base_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          knowledge_base_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_bases_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_knowledge_bases_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          additional_info: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          location_id: string
          name: string
          objective: string | null
          personality: string | null
          settings: Json | null
          system_prompt: string | null
          updated_at: string | null
        }
        Insert: {
          additional_info?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location_id: string
          name: string
          objective?: string | null
          personality?: string | null
          settings?: Json | null
          system_prompt?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_info?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string
          name?: string
          objective?: string | null
          personality?: string | null
          settings?: Json | null
          system_prompt?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_batches: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          locked_at: string | null
          scheduled_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          locked_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          locked_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          agent_enabled: boolean | null
          conversation_id: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          agent_enabled?: boolean | null
          conversation_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          agent_enabled?: boolean | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      crawl_jobs: {
        Row: {
          agent_id: string | null
          created_at: string | null
          error: string | null
          finished_at: string | null
          id: string
          meta: Json | null
          source_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          meta?: Json | null
          source_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          meta?: Json | null
          source_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "crawl_jobs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "kb_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_jobs: {
        Row: {
          agent_id: string | null
          batch_id: string | null
          contact_id: string
          context_sources: Json | null
          conversation_id: string | null
          conversation_provider_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          knowledge_base_ids: string[] | null
          location_id: string
          message_id: string
          message_text: string | null
          message_type: string | null
          processing_time_ms: number | null
          response_text: string | null
          scheduled_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          batch_id?: string | null
          contact_id: string
          context_sources?: Json | null
          conversation_id?: string | null
          conversation_provider_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          knowledge_base_ids?: string[] | null
          location_id: string
          message_id: string
          message_text?: string | null
          message_type?: string | null
          processing_time_ms?: number | null
          response_text?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          batch_id?: string | null
          contact_id?: string
          context_sources?: Json | null
          conversation_id?: string | null
          conversation_provider_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          knowledge_base_ids?: string[] | null
          location_id?: string
          message_id?: string
          message_text?: string | null
          message_type?: string | null
          processing_time_ms?: number | null
          response_text?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_jobs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_jobs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "inbound_messages"
            referencedColumns: ["message_id"]
          },
        ]
      }
      inbound_messages: {
        Row: {
          agent_id: string | null
          body: string | null
          contact_id: string
          content_type: string | null
          conversation_id: string | null
          conversation_provider_id: string | null
          created_at: string | null
          direction: string | null
          id: string
          location_id: string
          message_id: string
          message_type: string | null
          raw_payload: Json | null
          source: string | null
          status: string | null
          timestamp: string | null
          webhook_id: string | null
        }
        Insert: {
          agent_id?: string | null
          body?: string | null
          contact_id: string
          content_type?: string | null
          conversation_id?: string | null
          conversation_provider_id?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string
          location_id: string
          message_id: string
          message_type?: string | null
          raw_payload?: Json | null
          source?: string | null
          status?: string | null
          timestamp?: string | null
          webhook_id?: string | null
        }
        Update: {
          agent_id?: string | null
          body?: string | null
          contact_id?: string
          content_type?: string | null
          conversation_id?: string | null
          conversation_provider_id?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string
          location_id?: string
          message_id?: string
          message_type?: string | null
          raw_payload?: Json | null
          source?: string | null
          status?: string | null
          timestamp?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_sources: {
        Row: {
          agent_id: string | null
          created_at: string | null
          created_by: string | null
          depth: number
          id: string
          is_active: boolean
          knowledge_base_id: string
          scope: Database["public"]["Enums"]["crawl_scope"]
          url: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          created_by?: string | null
          depth?: number
          id?: string
          is_active?: boolean
          knowledge_base_id: string
          scope?: Database["public"]["Enums"]["crawl_scope"]
          url: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          created_by?: string | null
          depth?: number
          id?: string
          is_active?: boolean
          knowledge_base_id?: string
          scope?: Database["public"]["Enums"]["crawl_scope"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_sources_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_sources_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_bases: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          location_id: string
          name: string
          settings: Json | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location_id: string
          name: string
          settings?: Json | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string
          name?: string
          settings?: Json | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_bases_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_items: {
        Row: {
          content: string
          content_type: string
          created_at: string | null
          embedding: string | null
          id: string
          knowledge_base_id: string
          metadata: Json | null
          source_entity_id: string | null
          source_entity_type: string | null
          title: string | null
          token_count: number | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          content: string
          content_type: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          knowledge_base_id: string
          metadata?: Json | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          title?: string | null
          token_count?: number | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          content?: string
          content_type?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          knowledge_base_id?: string
          metadata?: Json | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          title?: string | null
          token_count?: number | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_items_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      location_token: {
        Row: {
          accesstoken: string
          created_at: string | null
          expires_at: string | null
          id: string
          locationid: string
        }
        Insert: {
          accesstoken: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          locationid: string
        }
        Update: {
          accesstoken?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          locationid?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string | null
          description: string | null
          ghl_location_id: string | null
          id: string
          is_active: boolean | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ghl_location_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ghl_location_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      acquire_batch_lock: {
        Args: { lock_expiry_iso: string; now_iso: string }
        Returns: { conversation_id: string; id: string }[]
      }
      acquire_specific_batch_lock: {
        Args: {
          lock_expiry_iso: string
          now_iso: string
          target_batch_id: string
        }
        Returns: { id: string }[]
      }
      delete_kb_source_cascade: {
        Args: { source_id_to_delete: string }
        Returns: {
          crawl_jobs_deleted: number
          knowledge_items_deleted: number
        }[]
      }
      search_knowledge_items: {
        Args: {
          content_types?: string[]
          kb_ids?: string[]
          query_embedding: string
          similarity_threshold?: number
          top_k?: number
        }
        Returns: {
          content: string
          content_type: string
          created_at: string
          id: string
          knowledge_base_id: string
          metadata: Json
          similarity: number
          title: string
          token_count: number
          url: string
        }[]
      }
      search_knowledge_items_text: {
        Args: {
          content_types?: string[]
          kb_ids?: string[]
          query_text: string
          top_k?: number
        }
        Returns: {
          content: string
          content_type: string
          created_at: string
          id: string
          knowledge_base_id: string
          metadata: Json
          title: string
          token_count: number
          url: string
        }[]
      }
      upsert_conversation_batch: {
        Args: { p_conversation_id: string; p_scheduled_at: string }
        Returns: { batch_id: string; is_new: boolean }[]
      }
    }
    Enums: {
      crawl_scope: "domain" | "path" | "single"
      job_status: "pending" | "running" | "success" | "error"
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]
