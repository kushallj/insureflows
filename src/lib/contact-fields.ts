export const PIPELINE_STAGES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PREFERRED_CHANNELS = ["whatsapp", "sms", "email"] as const;
export type PreferredChannel = (typeof PREFERRED_CHANNELS)[number];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

export type SortKey =
  | "lead_score_desc"
  | "lead_score_asc"
  | "next_followup_asc"
  | "next_followup_desc"
  | "created_desc";

export type Contact = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  age: number | null;
  date_of_birth: string | null;
  occupation: string | null;
  city: string | null;
  income: number | null;
  preferred_language: string | null;
  lead_source: string | null;
  tags: string[];
  whatsapp_opt_in: boolean;
  sms_opt_in: boolean;
  email_opt_in: boolean;
  preferred_channel: PreferredChannel;
  lead_score: number;
  pipeline_stage: PipelineStage;
  last_contact_at: string | null;
  next_followup_at: string | null;
  notes: string | null;
  ai_summary: string | null;
  referred_by_contact_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  age?: number | null;
  date_of_birth?: string | null;
  occupation?: string | null;
  city?: string | null;
  income?: number | null;
  preferred_language?: string | null;
  lead_source?: string | null;
  tags?: string[];
  whatsapp_opt_in?: boolean;
  sms_opt_in?: boolean;
  email_opt_in?: boolean;
  preferred_channel?: PreferredChannel;
  lead_score?: number;
  pipeline_stage?: PipelineStage;
  last_contact_at?: string | null;
  next_followup_at?: string | null;
  notes?: string | null;
  referred_by_contact_id?: string | null;
};

export const IMPORTABLE_FIELDS: { key: keyof ContactInput; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "gender", label: "Gender" },
  { key: "age", label: "Age" },
  { key: "date_of_birth", label: "Date of birth" },
  { key: "occupation", label: "Occupation" },
  { key: "city", label: "City" },
  { key: "income", label: "Income" },
  { key: "preferred_language", label: "Preferred language" },
  { key: "lead_source", label: "Lead source" },
  { key: "tags", label: "Tags (comma-separated)" },
  { key: "whatsapp_opt_in", label: "WhatsApp opt-in" },
  { key: "sms_opt_in", label: "SMS opt-in" },
  { key: "email_opt_in", label: "Email opt-in" },
  { key: "preferred_channel", label: "Preferred channel" },
  { key: "lead_score", label: "Lead score" },
  { key: "pipeline_stage", label: "Pipeline stage" },
  { key: "notes", label: "Notes" },
];
