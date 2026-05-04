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
 *
 * == swallowed-error wrap policy (PR-B3, Joey 2026-05-04) ==
 *
 * All transaction_audit writes in this file use **side-effect log+continue**
 * — capture { error }, log via logger.error with `(non-fatal — proceeding
 * without audit trail)`, continue. This deviates from the helper-default
 * policy of `.throwOnError()` because:
 *
 *   - This module's purpose is to make wrapped transactions MORE reliable.
 *     Throwing on audit-row failure would invert the design promise — a
 *     failed forensic-log insert would propagate up and break the wrapped
 *     transaction even when its underlying business steps would have
 *     succeeded.
 *
 *   - The existing code is already structurally tolerant of audit-write
 *     failure: `auditId = audit?.id` makes the id optional, and every
 *     subsequent update is guarded by `if (auditId)`. So a failed insert
 *     just means we lose forensic visibility for that one transaction;
 *     the underlying steps still execute normally.
 *
 *   - The transaction_audit table is a forensic-recovery layer, not a
 *     state-of-record layer. Failed writes here are observability
 *     degradation, not data corruption.
 *
 * Per-call-site comments below restate the local reasoning so future
 * contributors editing individual sites don't have to scroll up.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import logger from "./logger";

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
  
  // Side-effect log+continue (audit insert): if this fails we proceed
  // without forensic trail for this transaction. The underlying steps
  // still execute, and `if (auditId)` guards downstream updates.
  const { data: audit, error: auditInsertErr } = await supabase
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
  if (auditInsertErr) {
    logger.error("[transaction-safety] audit insert failed (non-fatal — proceeding without audit trail)", {
      tenantId, operationType, entityId, err: auditInsertErr,
    });
  }

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
        
        // Update audit with failure. Side-effect log+continue: even if
        // this update fails, the rollback already ran and the caller
        // gets the structured failure result below — losing the audit
        // update is observability degradation, not state corruption.
        if (auditId) {
          const { error: failUpdErr } = await supabase
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
          if (failUpdErr) {
            logger.error("[transaction-safety] audit failure-update failed (non-fatal — rollback already ran)", {
              auditId, failedStep: step.name, err: failUpdErr,
            });
          }
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
      
      // Update audit progress. Side-effect log+continue: a missed
      // progress-update means the steps_completed array drifts
      // mid-transaction in the audit row, but the in-memory tracking
      // remains correct and the final completion-update will overwrite.
      if (auditId) {
        const { error: progErr } = await supabase
          .from("transaction_audit")
          .update({
            steps_completed: completedSteps.map(s => s.name),
          })
          .eq("id", auditId);
        if (progErr) {
          logger.error("[transaction-safety] audit progress-update failed (non-fatal — final completion-update reconciles)", {
            auditId, completedStep: step.name, err: progErr,
          });
        }
      }
    }
    
    // All steps completed. Side-effect log+continue: business steps
    // already succeeded — losing the completion-marker just means the
    // audit row stays at status="in_progress" until detectIncomplete
    // sweeps it. The transaction itself is sound.
    if (auditId) {
      const { error: completionErr } = await supabase
        .from("transaction_audit")
        .update({
          status: "completed",
          steps_completed: completedSteps.map(s => s.name),
          completed_at: new Date().toISOString(),
        })
        .eq("id", auditId);
      if (completionErr) {
        logger.error("[transaction-safety] audit completion-update failed (non-fatal — business steps succeeded)", {
          auditId, err: completionErr,
        });
      }
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
    
    // Catch-block audit update. Side-effect log+continue: an unexpected
    // throw already triggered rollback above; the caller receives the
    // structured failure result below. Losing the audit "error" marker
    // is observability degradation only.
    if (auditId) {
      const { error: catchUpdErr } = await supabase
        .from("transaction_audit")
        .update({
          status: "error",
          error: String(e),
          steps_completed: completedSteps.map(s => s.name),
          rollback_attempted: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", auditId);
      if (catchUpdErr) {
        logger.error("[transaction-safety] audit catch-update failed (non-fatal — rollback already ran, original error returned to caller)", {
          auditId, originalError: String(e), err: catchUpdErr,
        });
      }
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
