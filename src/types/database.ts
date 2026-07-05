export type UserRole = 'admin' | 'manager' | 'field'
export type ContactStatus = 'lead' | 'prospect' | 'active' | 'inactive' | 'archived'
export type JobStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'invoiced' | 'paid'
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'declined' | 'expired' | 'converted'
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'void'
export type MessageDirection = 'inbound' | 'outbound'
export type ConversationChannel = 'sms' | 'email' | 'facebook_dm' | 'instagram_dm' | 'whatsapp' | 'live_chat' | 'call'

export interface Organisation {
  id: string
  created_at: string
  updated_at: string
  name: string
  abn: string | null
  phone: string | null
  email: string | null
  address: string | null
  logo_url: string | null
  stripe_account_id: string | null
  twilio_subaccount_sid: string | null
  default_payment_terms_days: number
  timezone: string
  subscription_plan: string
}

export interface User {
  id: string
  created_at: string
  updated_at: string
  org_id: string
  email: string
  full_name: string
  role: UserRole
  phone: string | null
  avatar_url: string | null
  hourly_rate: number | null
  is_active: boolean
  supabase_auth_id: string | null
}

export interface Contact {
  id: string
  created_at: string
  updated_at: string
  org_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_name: string | null
  address_line1: string | null
  address_line2: string | null
  suburb: string | null
  state: string | null
  postcode: string | null
  country: string | null
  status: ContactStatus
  source: string | null
  source_campaign_id: string | null
  pipeline_stage_id: string | null
  tags: string[]
  custom_fields: Record<string, unknown>
  lifetime_value: number
  notes: string | null
  assigned_to: string | null
  last_contacted_at: string | null
  do_not_contact: boolean
}

export interface Property {
  id: string
  created_at: string
  updated_at: string
  org_id: string
  contact_id: string
  label: string | null
  address_line1: string
  address_line2: string | null
  suburb: string
  state: string
  postcode: string
  lat: number | null
  lng: number | null
  access_notes: string | null
  gate_code: string | null
}

export interface Service {
  id: string
  created_at: string
  updated_at: string
  org_id: string
  name: string
  description: string | null
  category: string | null
  unit_price: number
  unit: string
  tax_rate: number
  is_active: boolean
}

export interface LineItem {
  service_id?: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  subtotal: number
}

export interface Quote {
  id: string
  created_at: string
  updated_at: string
  org_id: string
  contact_id: string
  property_id: string | null
  quote_number: string
  status: QuoteStatus
  line_items: LineItem[]
  subtotal: number
  tax: number
  total: number
  notes: string | null
  internal_notes: string | null
  valid_until: string | null
  sent_at: string | null
  viewed_at: string | null
  approved_at: string | null
  approved_by: string | null
  signature_url: string | null
  converted_to_job_id: string | null
  pdf_url: string | null
}

export interface Job {
  id: string
  created_at: string
  updated_at: string
  org_id: string
  contact_id: string
  property_id: string | null
  quote_id: string | null
  job_number: string
  title: string
  description: string | null
  job_type: 'one_off' | 'recurring'
  recurrence_rule: string | null
  status: JobStatus
  scheduled_start: string | null
  scheduled_end: string | null
  actual_start: string | null
  actual_end: string | null
  assigned_users: string[]
  checklist: ChecklistItem[]
  instructions: string | null
  photos: JobPhoto[]
  materials_used: LineItem[]
  total_hours: number | null
  invoice_id: string | null
  source_lead_id: string | null
}

export interface ChecklistItem {
  label: string
  completed: boolean
  completed_by: string | null
  completed_at: string | null
}

export interface JobPhoto {
  url: string
  caption: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export interface Invoice {
  id: string
  created_at: string
  updated_at: string
  org_id: string
  contact_id: string
  job_id: string | null
  invoice_number: string
  status: InvoiceStatus
  line_items: LineItem[]
  subtotal: number
  tax: number
  total: number
  amount_paid: number
  due_date: string | null
  sent_at: string | null
  paid_at: string | null
  payment_method: string | null
  stripe_payment_intent_id: string | null
  pdf_url: string | null
  notes: string | null
}

export interface Timesheet {
  id: string
  created_at: string
  updated_at: string
  org_id: string
  user_id: string
  job_id: string | null
  visit_id: string | null
  clocked_in_at: string
  clocked_out_at: string | null
  clock_in_lat: number | null
  clock_in_lng: number | null
  clock_out_lat: number | null
  clock_out_lng: number | null
  clock_in_address: string | null
  clock_out_address: string | null
  total_minutes: number | null
  notes: string | null
  approved: boolean
  approved_by: string | null
  approved_at: string | null
}

export interface Conversation {
  id: string
  created_at: string
  updated_at: string
  org_id: string
  contact_id: string
  channel: ConversationChannel
  external_thread_id: string | null
  status: string
  assigned_to: string | null
  last_message_at: string | null
  unread_count: number
}

export interface Message {
  id: string
  created_at: string
  updated_at: string
  org_id: string
  conversation_id: string
  direction: MessageDirection
  content: string
  media_urls: string[]
  sent_by: string | null
  sent_at: string
  delivered_at: string | null
  read_at: string | null
  external_message_id: string | null
  is_automated: boolean
  automation_workflow_id: string | null
}

export interface PipelineStage {
  id: string
  created_at: string
  updated_at: string
  org_id: string
  name: string
  position: number
  color: string
  pipeline_type: string
}
