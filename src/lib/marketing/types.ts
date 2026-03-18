// Marketing module types

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
export type RecipientType = 'all' | 'segment' | 'tags' | 'manual';
export type EmailSendStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
export type SMSSendStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export type AutomationType = 
  | 'birthday'
  | 'anniversary'
  | 'repair_ready_reminder'
  | 'reengagement'
  | 'post_purchase'
  | 'appointment_24h'
  | 'appointment_1h'
  | 'valentines'
  | 'mothers_day'
  | 'christmas';

export interface EmailCampaign {
  id: string;
  tenant_id: string;
  name: string;
  subject: string;
  body: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_type: RecipientType;
  recipient_filter: {
    segment_id?: string;
    tags?: string[];
    customer_ids?: string[];
  };
  stats: {
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
  };
  created_at: string;
  updated_at: string;
}

export interface MarketingAutomation {
  id: string;
  tenant_id: string;
  automation_type: AutomationType;
  enabled: boolean;
  settings: Record<string, unknown>;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerSegment {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  rules: SegmentRules;
  is_system: boolean;
  customer_count: number;
  created_at: string;
  updated_at: string;
}

export interface SegmentRules {
  type?: 'vip' | 'new' | 'lapsed' | 'repair' | 'high_value' | 'custom';
  percentile?: number;
  days?: number;
  months?: number;
  amount?: number;
  conditions?: SegmentCondition[];
}

export interface SegmentCondition {
  field: 'total_spend' | 'purchase_count' | 'last_purchase' | 'tags' | 'location' | 'category';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'not_contains';
  value: string | number | string[];
}

export interface EmailTemplate {
  id: string;
  tenant_id: string;
  name: string;
  subject: string;
  body: string;
  template_type: string | null;
  is_system: boolean;
  variables: string[];
  created_at: string;
  updated_at: string;
}

export interface EmailSend {
  id: string;
  tenant_id: string;
  campaign_id: string | null;
  customer_id: string | null;
  email: string;
  subject: string | null;
  status: EmailSendStatus;
  resend_id: string | null;
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
}

export interface SMSSend {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  phone: string;
  message: string;
  status: SMSSendStatus;
  twilio_sid: string | null;
  sent_at: string;
  delivered_at: string | null;
  error_message: string | null;
}

export interface MarketingStats {
  emailsSentThisMonth: number;
  openRate: number;
  clickRate: number;
  smsSentThisMonth: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalSegments: number;
  totalTemplates: number;
}

export interface CustomerForMarketing {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  tags: string[] | null;
  total_spend?: number;
  purchase_count?: number;
  last_purchase_at?: string | null;
  created_at: string;
}
