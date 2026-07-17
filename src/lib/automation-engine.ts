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

export async function runAutomations(
  supabase: SupabaseClient,
  triggerType: string,
  triggerData: Record<string, unknown>,
  context: ExecutionContext
) {
  // Find active matching workflows
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

    // Create execution record
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

    // Load contact for variable substitution
    let contact: Contact | null = null
    if (context.contactId) {
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone, do_not_contact')
        .eq('id', context.contactId)
        .single()
      contact = data
    }

    let stepsCompleted = 0
    let error: string | null = null

    const steps = workflow.steps as Step[]
    for (const step of steps) {
      try {
        if (step.type === 'send_sms') {
          // AU Spam Act: never send to a contact who has opted out.
          if (contact?.do_not_contact) {
            stepsCompleted++
            continue
          }

          const template = (step.config.message as string) ?? ''
          const unsubscribeUrl = contact
            ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/unsubscribe/${contact.id}`
            : ''
          let message = template
            .replace(/{{first_name}}/g, contact?.first_name ?? '')
            .replace(/{{last_name}}/g, contact?.last_name ?? '')
            .replace(/{{unsubscribe_url}}/g, unsubscribeUrl)
          // Every commercial message must carry a functional unsubscribe. If the
          // template didn't include one, append it.
          if (unsubscribeUrl && !template.includes('{{unsubscribe_url}}')) {
            message += `\n\nReply STOP or opt out: ${unsubscribeUrl}`
          }

          const to = contact?.phone
          if (to) {
            const sid = process.env.TWILIO_ACCOUNT_SID
            const token = process.env.TWILIO_AUTH_TOKEN
            const from = process.env.TWILIO_PHONE_NUMBER

            if (sid && token && from && sid !== 'placeholder') {
              const { default: twilio } = await import('twilio')
              const client = twilio(sid, token)
              const msg = await client.messages.create({ body: message, from, to })

              // Save to inbox if contact exists
              if (contact) {
                const { data: conv } = await supabase
                  .from('conversations')
                  .select('id')
                  .eq('org_id', context.orgId)
                  .eq('contact_id', contact.id)
                  .eq('channel', 'sms')
                  .eq('status', 'open')
                  .maybeSingle()

                const convId = conv?.id ?? (await supabase.from('conversations').insert({
                  org_id: context.orgId,
                  contact_id: contact.id,
                  channel: 'sms',
                  status: 'open',
                  last_message_at: new Date().toISOString(),
                }).select('id').single()).data?.id

                if (convId) {
                  await supabase.from('messages').insert({
                    org_id: context.orgId,
                    conversation_id: convId,
                    direction: 'outbound',
                    content: message,
                    sent_at: new Date().toISOString(),
                    external_message_id: msg.sid,
                    is_automated: true,
                    automation_workflow_id: workflow.id,
                  })
                }
              }
            }
          }
        }

        if (step.type === 'update_stage' && context.contactId && step.config.stageId) {
          await supabase
            .from('contacts')
            .update({ pipeline_stage_id: step.config.stageId as string })
            .eq('id', context.contactId)
            .eq('org_id', context.orgId)
        }

        if (step.type === 'create_note' && context.contactId && step.config.note) {
          // Notes stored as a simple activity — extend later
          console.log(`Auto-note for contact ${context.contactId}: ${step.config.note}`)
        }

        // 'wait' steps are logged but not actually delayed in this implementation
        // In production you'd queue these with a job scheduler

        stepsCompleted++
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
        steps_completed: stepsCompleted,
        error,
      })
      .eq('id', exec.id)
  }
}
