import { SupabaseClient } from '@supabase/supabase-js'

interface Step {
  id: string
  type: string
  config: Record<string, unknown>
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  do_not_contact: boolean
}

interface ExecutionContext {
  contactId?: string
  jobId?: string
  orgId: string
}

// Identifies a single running workflow execution as it moves through its steps
// (possibly across multiple cron resumes).
interface StepContext {
  orgId: string
  workflowId: string
  executionId: string
  contactId?: string
  jobId?: string
}

async function loadContact(supabase: SupabaseClient, contactId?: string): Promise<Contact | null> {
  if (!contactId) return null
  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, do_not_contact')
    .eq('id', contactId)
    .single()
  return data
}

// Trigger entry point: fired inline when something happens (e.g. a pipeline
// stage change). Creates an execution per matching workflow and runs it from
// the top — pausing at the first `wait` step (see executeSteps).
export async function runAutomations(
  supabase: SupabaseClient,
  triggerType: string,
  triggerData: Record<string, unknown>,
  context: ExecutionContext
) {
  const { data: workflows } = await supabase
    .from('workflows')
    .select('id, trigger_type, trigger_conditions, steps')
    .eq('org_id', context.orgId)
    .eq('is_active', true)
    .eq('trigger_type', triggerType)

  if (!workflows || workflows.length === 0) return

  for (const workflow of workflows) {
    // Check trigger conditions match
    const conditions = workflow.trigger_conditions as Record<string, unknown>
    if (triggerType === 'contact_stage_change' && conditions.stageId) {
      if (conditions.stageId !== triggerData.stageId) continue
    }
    if (triggerType === 'job_status_change' && conditions.status) {
      if (conditions.status !== triggerData.status) continue
    }

    const { data: exec } = await supabase
      .from('workflow_executions')
      .insert({
        org_id: context.orgId,
        workflow_id: workflow.id,
        contact_id: context.contactId ?? null,
        job_id: context.jobId ?? null,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (!exec) continue

    const contact = await loadContact(supabase, context.contactId)
    await executeSteps(
      supabase,
      { orgId: context.orgId, workflowId: workflow.id, executionId: exec.id, contactId: context.contactId, jobId: context.jobId },
      workflow.steps as Step[],
      0,
      contact,
    )
  }
}

// Resume a paused execution from the queue (called by the cron worker). Loads
// the workflow's steps and continues from the saved step index.
export async function resumeQueuedItem(
  supabase: SupabaseClient,
  item: { org_id: string; workflow_id: string; execution_id: string; contact_id: string | null; step_index: number },
) {
  const { data: workflow } = await supabase
    .from('workflows')
    .select('id, steps')
    .eq('id', item.workflow_id)
    .single()

  if (!workflow) {
    await supabase
      .from('workflow_executions')
      .update({ status: 'failed', completed_at: new Date().toISOString(), error: 'Workflow no longer exists' })
      .eq('id', item.execution_id)
    return
  }

  const contact = await loadContact(supabase, item.contact_id ?? undefined)
  await executeSteps(
    supabase,
    { orgId: item.org_id, workflowId: item.workflow_id, executionId: item.execution_id, contactId: item.contact_id ?? undefined },
    workflow.steps as Step[],
    item.step_index,
    contact,
  )
}

// Runs steps from startIndex. On a `wait` step it enqueues a resume in
// automation_queue and RETURNS (the workflow is now paused); the cron worker
// picks it up when due. Otherwise it runs to completion.
async function executeSteps(
  supabase: SupabaseClient,
  ctx: StepContext,
  steps: Step[],
  startIndex: number,
  contact: Contact | null,
) {
  let error: string | null = null
  let i = startIndex

  for (; i < steps.length; i++) {
    const step = steps[i]
    try {
      if (step.type === 'wait') {
        const days = Number(step.config.days) || 1
        const scheduledFor = new Date(Date.now() + days * 86400000).toISOString()
        await supabase.from('automation_queue').insert({
          org_id: ctx.orgId,
          workflow_id: ctx.workflowId,
          execution_id: ctx.executionId,
          contact_id: ctx.contactId ?? null,
          step_index: i + 1, // resume AFTER the wait
          step_config: step.config,
          scheduled_for: scheduledFor,
          status: 'pending',
        })
        await supabase
          .from('workflow_executions')
          .update({ status: 'waiting', steps_completed: i + 1 })
          .eq('id', ctx.executionId)
        return // paused — cron worker resumes at i+1 when due
      }

      if (step.type === 'send_sms') {
        // AU Spam Act: never send to a contact who has opted out.
        if (!contact?.do_not_contact) {
          await sendSms(supabase, ctx, step, contact)
        }
      }

      if (step.type === 'update_stage' && ctx.contactId && step.config.stageId) {
        await supabase
          .from('contacts')
          .update({ pipeline_stage_id: step.config.stageId as string })
          .eq('id', ctx.contactId)
          .eq('org_id', ctx.orgId)
      }

      if (step.type === 'create_note' && ctx.contactId && step.config.note) {
        // Notes stored as a simple activity — extend later
        console.log(`Auto-note for contact ${ctx.contactId}: ${step.config.note}`)
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Step failed'
      break
    }
  }

  await supabase
    .from('workflow_executions')
    .update({
      status: error ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      steps_completed: error ? i : steps.length,
      error,
    })
    .eq('id', ctx.executionId)
}

// Sends one automated SMS with the unsubscribe line, and mirrors it into the inbox.
async function sendSms(supabase: SupabaseClient, ctx: StepContext, step: Step, contact: Contact | null) {
  const template = (step.config.message as string) ?? ''
  const unsubscribeUrl = contact
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/unsubscribe/${contact.id}`
    : ''
  let message = template
    .replace(/{{first_name}}/g, contact?.first_name ?? '')
    .replace(/{{last_name}}/g, contact?.last_name ?? '')
    .replace(/{{unsubscribe_url}}/g, unsubscribeUrl)
  // Every commercial message must carry a functional unsubscribe.
  if (unsubscribeUrl && !template.includes('{{unsubscribe_url}}')) {
    message += `\n\nReply STOP or opt out: ${unsubscribeUrl}`
  }

  const to = contact?.phone
  if (!to) return

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from || sid === 'placeholder') return

  const { default: twilio } = await import('twilio')
  const client = twilio(sid, token)
  const msg = await client.messages.create({ body: message, from, to })

  if (!contact) return

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('contact_id', contact.id)
    .eq('channel', 'sms')
    .eq('status', 'open')
    .maybeSingle()

  const convId = conv?.id ?? (await supabase.from('conversations').insert({
    org_id: ctx.orgId,
    contact_id: contact.id,
    channel: 'sms',
    status: 'open',
    last_message_at: new Date().toISOString(),
  }).select('id').single()).data?.id

  if (convId) {
    await supabase.from('messages').insert({
      org_id: ctx.orgId,
      conversation_id: convId,
      direction: 'outbound',
      content: message,
      sent_at: new Date().toISOString(),
      external_message_id: msg.sid,
      is_automated: true,
      automation_workflow_id: ctx.workflowId,
    })
  }
}
