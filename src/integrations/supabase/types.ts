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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          contact_id: string
          created_at: string
          description: string | null
          id: string
          user_id: string
        }
        Insert: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          contact_id: string
          created_at?: string
          description?: string | null
          id?: string
          user_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          contact_id?: string
          created_at?: string
          description?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience_count_snapshot: number | null
          channel: Database["public"]["Enums"]["template_channel"]
          clicked_count: number
          created_at: string
          created_by: string | null
          delivered_count: number
          failed_count: number
          id: string
          name: string
          opened_count: number
          scheduled_at: string | null
          segment_id: string | null
          sent_count: number
          status: Database["public"]["Enums"]["campaign_status"]
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audience_count_snapshot?: number | null
          channel: Database["public"]["Enums"]["template_channel"]
          clicked_count?: number
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          failed_count?: number
          id?: string
          name: string
          opened_count?: number
          scheduled_at?: string | null
          segment_id?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audience_count_snapshot?: number | null
          channel?: Database["public"]["Enums"]["template_channel"]
          clicked_count?: number
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          failed_count?: number
          id?: string
          name?: string
          opened_count?: number
          scheduled_at?: string | null
          segment_id?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          age: number | null
          ai_summary: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          email_opt_in: boolean
          gender: string | null
          id: string
          income: number | null
          last_contact_at: string | null
          lead_score: number
          lead_source: string | null
          name: string
          next_followup_at: string | null
          notes: string | null
          occupation: string | null
          organization_id: string | null
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          preferred_channel: Database["public"]["Enums"]["preferred_channel"]
          preferred_language: string | null
          sms_opt_in: boolean
          tags: string[]
          updated_at: string
          user_id: string
          whatsapp_opt_in: boolean
        }
        Insert: {
          age?: number | null
          ai_summary?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          email_opt_in?: boolean
          gender?: string | null
          id?: string
          income?: number | null
          last_contact_at?: string | null
          lead_score?: number
          lead_source?: string | null
          name: string
          next_followup_at?: string | null
          notes?: string | null
          occupation?: string | null
          organization_id?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          preferred_channel?: Database["public"]["Enums"]["preferred_channel"]
          preferred_language?: string | null
          sms_opt_in?: boolean
          tags?: string[]
          updated_at?: string
          user_id: string
          whatsapp_opt_in?: boolean
        }
        Update: {
          age?: number | null
          ai_summary?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          email_opt_in?: boolean
          gender?: string | null
          id?: string
          income?: number | null
          last_contact_at?: string | null
          lead_score?: number
          lead_source?: string | null
          name?: string
          next_followup_at?: string | null
          notes?: string | null
          occupation?: string | null
          organization_id?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          preferred_channel?: Database["public"]["Enums"]["preferred_channel"]
          preferred_language?: string | null
          sms_opt_in?: boolean
          tags?: string[]
          updated_at?: string
          user_id?: string
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["organization_kind"]
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["organization_kind"]
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["organization_kind"]
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          contact_id: string
          created_at: string
          document_path: string | null
          id: string
          insurer_name: string | null
          notes: string | null
          policy_number: string
          policy_type: Database["public"]["Enums"]["policy_type"]
          premium_amount: number | null
          renewal_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["policy_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          document_path?: string | null
          id?: string
          insurer_name?: string | null
          notes?: string | null
          policy_number: string
          policy_type?: Database["public"]["Enums"]["policy_type"]
          premium_amount?: number | null
          renewal_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["policy_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          document_path?: string | null
          id?: string
          insurer_name?: string | null
          notes?: string | null
          policy_number?: string
          policy_type?: Database["public"]["Enums"]["policy_type"]
          premium_amount?: number | null
          renewal_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["policy_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          created_at: string
          description: string | null
          filter_criteria: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filter_criteria?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filter_criteria?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          related_contact_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_contact_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_contact_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["template_channel"]
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["template_status"]
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          channel: Database["public"]["Enums"]["template_channel"]
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["template_status"]
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["template_channel"]
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["template_status"]
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      activity_type:
        | "note"
        | "stage_change"
        | "task_completed"
        | "message_sent"
        | "other"
      campaign_status:
        | "draft"
        | "scheduled"
        | "sending"
        | "paused"
        | "completed"
        | "cancelled"
      organization_kind: "family" | "business" | "other"
      pipeline_stage:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "won"
        | "lost"
      policy_status: "active" | "lapsed" | "cancelled"
      policy_type: "life" | "health" | "motor" | "other"
      preferred_channel: "whatsapp" | "sms" | "email"
      task_priority: "low" | "normal" | "high"
      task_status: "open" | "done"
      template_channel: "whatsapp" | "sms" | "email"
      template_status: "draft" | "approved"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "note",
        "stage_change",
        "task_completed",
        "message_sent",
        "other",
      ],
      campaign_status: [
        "draft",
        "scheduled",
        "sending",
        "paused",
        "completed",
        "cancelled",
      ],
      organization_kind: ["family", "business", "other"],
      pipeline_stage: [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "won",
        "lost",
      ],
      policy_status: ["active", "lapsed", "cancelled"],
      policy_type: ["life", "health", "motor", "other"],
      preferred_channel: ["whatsapp", "sms", "email"],
      task_priority: ["low", "normal", "high"],
      task_status: ["open", "done"],
      template_channel: ["whatsapp", "sms", "email"],
      template_status: ["draft", "approved"],
    },
  },
} as const
