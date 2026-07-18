import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import path from 'path'

const LOGO_PATH = path.join(process.cwd(), 'public', 'salt-air-logo.png')

function money(n: number) {
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
function fmtDate(d: string | null) {
  if (!d) return ''
  const dt = new Date(d)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`
}
const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer', cash: 'Cash', card: 'Card', cheque: 'Cheque', other: 'Other',
}

const NAVY = '#2C3E50'

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b', padding: 48, backgroundColor: '#ffffff' },
  brandRule: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: NAVY },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  logo: { width: 100, height: 'auto', marginBottom: 6 },
  orgContact: { fontSize: 9, color: '#64748b', lineHeight: 1.6 },
  docTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: NAVY, textAlign: 'right' },
  docMeta: { fontSize: 9, color: '#64748b', textAlign: 'right', lineHeight: 1.6, marginTop: 6 },
  section: { marginBottom: 24 },
  label: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  strong: { fontSize: 11, color: '#1e293b' },
  paidBanner: { backgroundColor: '#dcfce7', borderRadius: 4, padding: 14, marginBottom: 24, marginTop: 8 },
  paidText: { color: '#166534', fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginTop: 6 },
  amountLabel: { fontSize: 13, color: NAVY, fontFamily: 'Helvetica-Bold' },
  amountValue: { fontSize: 16, color: NAVY, fontFamily: 'Helvetica-Bold' },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    borderTop: '1pt solid #e2e8f0',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 1.5,
  },
})

interface Props {
  payment: { receipt_number: string; amount: number; method: string; recorded_at: string | null; reference: string | null }
  invoice: { invoice_number: string; total: number }
  org: { name: string; abn: string | null; phone: string | null; email: string | null; address: string | null }
  contact: { first_name: string; last_name: string } | null
  balanceRemaining: number
  serviceDate?: string | null
}

export function ReceiptPDF({ payment, invoice, org, contact, balanceRemaining, serviceDate }: Props) {
  const fullyPaid = balanceRemaining <= 0
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandRule} fixed />
        <View style={styles.header}>
          <View>
            <Image src={LOGO_PATH} style={styles.logo} />
            <Text style={styles.orgContact}>
              {org.phone ? `${org.phone}\n` : ''}{org.email ?? ''}{org.abn ? `\nABN ${org.abn}` : ''}
            </Text>
          </View>
          <View>
            <Text style={styles.docTitle}>RECEIPT</Text>
            <Text style={styles.docMeta}>
              {payment.receipt_number}
              {`\n${fmtDate(payment.recorded_at)}`}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Received from</Text>
          <Text style={styles.strong}>{contact ? `${contact.first_name} ${contact.last_name}` : '—'}</Text>
        </View>

        <View style={styles.paidBanner}>
          <Text style={styles.paidText}>
            {fullyPaid ? '✓ Payment received in full — thank you.' : '✓ Payment received — thank you.'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text>Invoice</Text>
          <Text>{invoice.invoice_number}</Text>
        </View>
        {serviceDate ? (
          <View style={styles.row}>
            <Text>Service date</Text>
            <Text>{fmtDate(serviceDate)}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text>Payment method</Text>
          <Text>{METHOD_LABEL[payment.method] ?? payment.method}</Text>
        </View>
        {payment.reference ? (
          <View style={styles.row}>
            <Text>Reference</Text>
            <Text>{payment.reference}</Text>
          </View>
        ) : null}

        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Amount paid</Text>
          <Text style={styles.amountValue}>{money(payment.amount)}</Text>
        </View>

        {!fullyPaid ? (
          <View style={styles.row}>
            <Text>Balance remaining</Text>
            <Text>{money(balanceRemaining)}</Text>
          </View>
        ) : null}

      </Page>
    </Document>
  )
}
