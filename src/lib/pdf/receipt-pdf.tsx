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

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b', padding: 48, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  logo: { width: 120, height: 'auto', marginBottom: 6 },
  orgContact: { fontSize: 9, color: '#64748b', lineHeight: 1.6 },
  docTitle: { fontSize: 24, fontWeight: 'bold', color: '#2C3E50', textAlign: 'right' },
  docMeta: { fontSize: 9, color: '#64748b', textAlign: 'right', lineHeight: 1.6, marginTop: 6 },
  section: { marginBottom: 24 },
  label: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  strong: { fontSize: 11, color: '#1e293b' },
  paidBanner: { backgroundColor: '#dcfce7', borderRadius: 4, padding: 14, marginBottom: 24, marginTop: 8 },
  paidText: { color: '#166534', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginTop: 6 },
  amountLabel: { fontSize: 13, color: '#2C3E50', fontWeight: 'bold' },
  amountValue: { fontSize: 16, color: '#2C3E50', fontWeight: 'bold' },
  footer: { marginTop: 40, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
})

interface Props {
  payment: { receipt_number: string; amount: number; method: string; recorded_at: string | null; reference: string | null }
  invoice: { invoice_number: string; total: number }
  org: { name: string; abn: string | null; phone: string | null; email: string | null; address: string | null }
  contact: { first_name: string; last_name: string } | null
  balanceRemaining: number
}

export function ReceiptPDF({ payment, invoice, org, contact, balanceRemaining }: Props) {
  const fullyPaid = balanceRemaining <= 0
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Image src={LOGO_PATH} style={styles.logo} />
            <Text style={styles.orgContact}>
              {org.name}
              {org.phone ? `\n${org.phone}` : ''}
              {org.email ? `\n${org.email}` : ''}
              {org.address ? `\n${org.address}` : ''}
              {org.abn ? `\nABN: ${org.abn}` : ''}
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

        <Text style={styles.footer}>This is an official receipt for payment received against invoice {invoice.invoice_number}.</Text>
      </Page>
    </Document>
  )
}
