export type ReviewState = 'pending' | 'in_review' | 'approved' | 'rejected' | 'escalated'

export interface ExceptionRecord {
  id: string
  exception_id: string
  po_number: string | null
  shipment_id: string | null
  exception_type: string | null
  detected_at: string | null
  severity: 'low' | 'medium' | 'high' | 'critical' | null
  description: string | null
  related_sku: string | null
  missing_fields: string[]

  review_state: ReviewState
  ai_summary: string | null
  ai_suggested_action: string | null
  ai_confidence: number | null
  ai_generated_at: string | null
  ai_cache_hit: number

  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null

  created_at: string
  updated_at: string
}

export interface AuditEntry {
  id: string
  actor: string
  action: string
  previous_state: string | null
  new_state: string | null
  note: string | null
  timestamp: string
}

export interface SeedStatus {
  purchase_orders: number
  shipments: number
  inventory_changes: number
  supplier_emails: number
  delivery_exceptions: number
  cache_backend: string
}

export interface FieldDetectionMetrics {
  n_records: number
  detection_rate_v1_pct: number
  detection_rate_v2_pct: number
  improvement_percentage_points: number
  v1_baseline_ruleset: {
    recall: number
    precision: number
    total_ground_truth_missing_fields: number
    true_positives: number
    recall_by_record_type: Record<string, number | null>
  }
  v2_iterated_ruleset: {
    recall: number
    precision: number
    total_ground_truth_missing_fields: number
    true_positives: number
    recall_by_record_type: Record<string, number | null>
  }
}

export interface TriageScenario {
  scenario_id: string
  exception_type: string
  missing_fields: number
  related_records: number
  ambiguity: 'low' | 'medium' | 'high'
  manual_minutes: number
  ai_assisted_minutes: number
}

export interface TriageMetrics {
  n_scenarios: number
  mean_manual_minutes: number
  mean_ai_assisted_minutes: number
  median_manual_minutes: number
  median_ai_assisted_minutes: number
  mean_reduction_pct: number
  median_reduction_pct: number
  min_scenario_reduction_pct: number
  max_scenario_reduction_pct: number
  scenarios: TriageScenario[]
}

export interface MetricsReport {
  missing_field_detection: FieldDetectionMetrics
  exception_triage_time: TriageMetrics
}
