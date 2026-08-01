import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { parseBody } from '@/lib/http'
import { zMoneyInput, zNullableText, zRequiredText, zUuid } from '@/lib/validation/common'

const serviceInputSchema = z.object({
  id: zUuid,
  name: zRequiredText(200),
  description: zNullableText(1000),
  unit_price: zMoneyInput,
  unit: zRequiredText(50),
})

const quoteSuggestSchema = z.object({
  description: zRequiredText(5000),
  services: z.array(serviceInputSchema).max(500),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, quoteSuggestSchema)
  if (!parsed.ok) return parsed.response
  const { description, services } = parsed.data

  const serviceList = services
    .map(s => `- ID:${s.id} | ${s.name} (${s.unit} @ $${s.unit_price})${s.description ? ': ' + s.description : ''}`)
    .join('\n')

  const prompt = `You are a quoting assistant for a professional field service company (cleaning, maintenance, landscaping, etc).

Based on the job description below, suggest appropriate line items from the available services list.
Return ONLY valid JSON — an array of objects with these exact keys:
  service_id (string, from the list), description (string), quantity (number), unit_price (number)

Available services:
${serviceList}

Job description: "${description}"

Rules:
- Only use service IDs from the list above
- Suggest realistic quantities
- If no service fits, use the closest match
- Return 1-6 line items
- No explanation, no markdown — just the raw JSON array`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'

  let suggestions: { service_id: string; description: string; quantity: number; unit_price: number }[] = []
  try {
    const cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
    suggestions = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: text }, { status: 500 })
  }

  return NextResponse.json({ suggestions })
}
