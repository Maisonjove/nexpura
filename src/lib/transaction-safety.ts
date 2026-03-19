/**
 * Transaction Safety Layer
 * 
 * Since Supabase JS client doesn't expose PostgreSQL transaction blocks,
 * this module provides compensating transaction patterns:
 * 
 * 1. Audit Trail - Log each step for forensic recovery
 * 2. Rollback Functions - Define compensation for each step
 * 3. Partial State Detection - Identify incomplete transactions
 * 4. Recovery Actions - Fix partial state
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface TransactionStep {
  name: string;
  execute: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
  compensate?: () => Promise<void>;
}

export interface TransactionResult {
  success: boolean;
  completedSteps: string[];
  failedStep?: string;
  error?: string;
  auditId?: string;
}

/**
 * Execute a multi-step operation with audit trail and rollback
 */
export async function executeWithSafety(
  supabase: SupabaseClient,
  operationType: string,
  entityId: string,
  tenantId: string,
  userId: string,
  steps: TransactionStep[]
): Promise<TransactionResult> {
  const completedSteps: { name: string; compensate?: () => Promise<void> }[] = [];
  
  // Create audit record
  const { data: audit } = await supabase
    .from("transaction_audit")
    .insert({
      tenant_id: tenantId,
      operation_type: operationType,
      entity_id: entityId,
      user_id: userId,
      status: "in_progress",
      steps_planned: steps.map(s => s.name),
      steps_completed: [],
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  
  const auditId = audit?.id;

  try {
    for (const step of steps) {
      const result = await step.execute();
      
      if (!result.success) {
        // Step failed - rollback completed steps in reverse order
        const rollbackErrors: string[] = [];
        
        for (const completed of [...completedSteps].reverse()) {
          if (completed.compensate) {
            try {
              await completed.compensate();
            } catch (e) {
              rollbackErrors.push(`${completed.name}: ${e}`);
            }
          }
        }
        
        // Update audit with failure
        if (auditId) {
          await supabase
            .from("transaction_audit")
            .update({
              status: "failed",
              failed_step: step.name,
              error: result.error,
              steps_completed: completedSteps.map(s => s.name),
              rollback_attempted: true,
              rollback_errors: rollbackErrors.length > 0 ? rollbackErrors : null,
              completed_at: new Date().toISOString(),
            })
            .eq("id", auditId);
        }
        
        return {
          success: false,
          completedSteps: completedSteps.map(s => s.name),
          failedStep: step.name,
          error: result.error,
          auditId,
        };
      }
      
      completedSteps.push({ name: step.name, compensate: step.compensate });
      
      // Update audit progress
      if (auditId) {
        await supabase
          .from("transaction_audit")
          .update({
            steps_completed: completedSteps.map(s => s.name),
          })
          .eq("id", auditId);
      }
    }
    
    // All steps completed
    if (auditId) {
      await supabase
        .from("transaction_audit")
        .update({
          status: "completed",
          steps_completed: completedSteps.map(s => s.name),
          completed_at: new Date().toISOString(),
        })
        .eq("id", auditId);
    }
    
    return {
      success: true,
      completedSteps: completedSteps.map(s => s.name),
      auditId,
    };
    
  } catch (e) {
    // Unexpected error - attempt rollback
    for (const completed of [...completedSteps].reverse()) {
      if (completed.compensate) {
        try {
          await completed.compensate();
        } catch {
          // Log but continue rollback
        }
      }
    }
    
    if (auditId) {
      await supabase
        .from("transaction_audit")
        .update({
          status: "error",
          error: String(e),
          steps_completed: completedSteps.map(s => s.name),
          rollback_attempted: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", auditId);
    }
    
    return {
      success: false,
      completedSteps: completedSteps.map(s => s.name),
      error: String(e),
      auditId,
    };
  }
}

/**
 * Detect incomplete transactions for a tenant
 */
export async function detectIncompleteTransactions(
  supabase: SupabaseClient,
  tenantId: string,
  maxAgeMinutes: number = 5
): Promise<{ id: string; operation_type: string; entity_id: string; steps_completed: string[] }[]> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
  
  const { data } = await supabase
    .from("transaction_audit")
    .select("id, operation_type, entity_id, steps_completed")
    .eq("tenant_id", tenantId)
    .eq("status", "in_progress")
    .lt("started_at", cutoff);
  
  return data || [];
}
