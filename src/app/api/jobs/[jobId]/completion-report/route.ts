import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function generatePDFContent(jobData: any, notes: any[]): string {
  const lines: string[] = []

  lines.push('%PDF-1.4')
  lines.push('1 0 obj')
  lines.push('<< /Type /Catalog /Pages 2 0 R >>')
  lines.push('endobj')
  lines.push('2 0 obj')
  lines.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  lines.push('endobj')
  lines.push('3 0 obj')
  lines.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>')
  lines.push('endobj')
  lines.push('4 0 obj')
  lines.push('<< /Length 1500 >>')
  lines.push('stream')

  let yPos = 750
  const pageHeight = 792
  const leftMargin = 40
  const rightMargin = 572
  const lineHeight = 12

  lines.push('BT')
  lines.push('/F1 24 Tf')
  lines.push(`${leftMargin} ${yPos} Td`)
  lines.push(`(${jobData.title}) Tj`)
  lines.push('ET')

  yPos -= 30

  lines.push('BT')
  lines.push('/F1 10 Tf')
  lines.push(`${leftMargin} ${yPos} Td`)
  lines.push(`(Job #${jobData.job_number} • Completion Report) Tj`)
  lines.push('ET')

  yPos -= 20

  lines.push('BT')
  lines.push('/F1 12 Tf')
  lines.push(`${leftMargin} ${yPos} Td`)
  lines.push('(Job Details) Tj')
  lines.push('ET')

  yPos -= 15

  const details = [
    `Status: ${jobData.status.replace('_', ' ').toUpperCase()}`,
    `Type: ${jobData.job_type}`,
    ...(jobData.description ? [`Description: ${jobData.description.substring(0, 50)}...`] : []),
  ]

  lines.push('BT')
  lines.push('/F1 11 Tf')
  for (const detail of details) {
    lines.push(`${leftMargin} ${yPos} Td`)
    lines.push(`(${detail.replace(/[()]/g, '')}) Tj`)
    yPos -= lineHeight
  }
  lines.push('ET')

  if (jobData.actual_start || jobData.actual_end) {
    yPos -= 10
    lines.push('BT')
    lines.push('/F1 12 Tf')
    lines.push(`${leftMargin} ${yPos} Td`)
    lines.push('(Schedule) Tj')
    lines.push('ET')

    yPos -= 15
    lines.push('BT')
    lines.push('/F1 11 Tf')
    if (jobData.actual_start) {
      lines.push(`${leftMargin} ${yPos} Td`)
      lines.push(`(Started: ${new Date(jobData.actual_start).toLocaleString()}) Tj`)
      yPos -= lineHeight
    }
    if (jobData.actual_end) {
      lines.push(`${leftMargin} ${yPos} Td`)
      lines.push(`(Completed: ${new Date(jobData.actual_end).toLocaleString()}) Tj`)
      yPos -= lineHeight
    }
    lines.push('ET')
  }

  if (notes.length > 0) {
    yPos -= 10
    lines.push('BT')
    lines.push('/F1 12 Tf')
    lines.push(`${leftMargin} ${yPos} Td`)
    lines.push(`(Notes & Photos: ${notes.length}) Tj`)
    lines.push('ET')

    yPos -= 15
    lines.push('BT')
    lines.push('/F1 10 Tf')
    for (const note of notes.slice(0, 10)) {
      const noteType = note.note_type === 'photo' ? 'Photo' : 'Note'
      const author = note.created_by_name ? ` by ${note.created_by_name}` : ''
      lines.push(`${leftMargin} ${yPos} Td`)
      lines.push(`(${noteType}${author}) Tj`)
      yPos -= lineHeight
      if (note.note_type === 'text') {
        lines.push(`${leftMargin} ${yPos} Td`)
        lines.push(`(${note.content.substring(0, 60).replace(/[()]/g, '')}) Tj`)
        yPos -= lineHeight
      }
    }
    lines.push('ET')
  }

  lines.push(`BT`)
  lines.push('/F1 9 Tf')
  lines.push(`${leftMargin} 20 Td`)
  lines.push(`(Generated on ${new Date().toLocaleString()}) Tj`)
  lines.push('ET')

  lines.push('endstream')
  lines.push('endobj')
  lines.push('5 0 obj')
  lines.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  lines.push('endobj')
  lines.push('xref')
  lines.push('0 6')
  lines.push('0000000000 65535 f')
  lines.push('0000000009 00000 n')
  lines.push('0000000058 00000 n')
  lines.push('0000000115 00000 n')
  lines.push('0000000244 00000 n')
  lines.push('0000001844 00000 n')
  lines.push('trailer')
  lines.push('<< /Size 6 /Root 1 0 R >>')
  lines.push('startxref')
  lines.push('1944')
  lines.push('%%EOF')

  return lines.join('\n')
}

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('org_id').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('org_id', profile.org_id)
    .single()

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: notes } = await supabase
    .from('job_notes')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  try {
    const pdfContent = generatePDFContent(job, notes ?? [])
    const buffer = Buffer.from(pdfContent, 'utf8')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="job-${jobId}-completion.pdf"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
