import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import path from 'path'
import { registerPdfFonts, SERIF } from './fonts'
import { stripDocYear } from '../format'

registerPdfFonts()

const LOGO_PATH = path.join(process.cwd(), 'public', 'salt-air-logo-pdf.png')

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
  logo: { width: 170, height: 'auto' },
  orgBlock: { alignItems: 'flex-end' },
  orgName: { fontFamily: SERIF, fontWeight: 'normal', fontSize: 20, color: NAVY, marginBottom: 4, textAlign: 'right' },
  orgContact: { fontSize: 9, color: '#64748b', lineHeight: 1.6, textAlign: 'right' },
  partiesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  metaBlock: { alignItems: 'flex-end' },
  docLabel: { fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'right' },
  docTitle: { fontFamily: SERIF, fontWeight: 'semibold', fontSize: 26, color: NAVY, textAlign: 'right', marginTop: 2 },
  docMeta: { fontSize: 9, color: '#64748b', textAlign: 'right', lineHeight: 1.6, marginTop: 8 },
  section: { marginBottom: 24 },
  label: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  strong: { fontSize: 11, color: '#1e293b' },
  paidBanner: { backgroundColor: '#dcfce7', borderRadius: 4, padding: 14, marginBottom: 24, marginTop: 8 },
  paidText: { color: '#166534', fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginTop: 6 },
  amountLabel: { fontSize: 15, color: NAVY, fontFamily: SERIF, fontWeight: 'semibold' },
  amountValue: { fontSize: 18, color: NAVY, fontFamily: SERIF, fontWeight: 'semibold' },
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
        {/* Header — logo left, business details top-right */}
        <View style={styles.header}>
          <Image src={LOGO_PATH} style={styles.logo} />
          <View style={styles.orgBlock}>
            <Text style={styles.orgName}>{org.name}</Text>
            <Text style={styles.orgContact}>
              {org.abn ? `ABN ${org.abn}\n` : ''}{org.email ?? ''}{org.phone ? `\n${org.phone}` : ''}
            </Text>
          </View>
        </View>

        {/* Parties — received-from left, receipt meta right (symmetrical) */}
        <View style={styles.partiesRow}>
          <View>
            <Text style={styles.label}>Received from</Text>
            <Text style={styles.strong}>{contact ? `${contact.first_name} ${contact.last_name}` : '—'}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.docLabel}>Receipt</Text>
            <Text style={styles.docTitle}>{stripDocYear(payment.receipt_number)}</Text>
            <Text style={styles.docMeta}>
              {fmtDate(payment.recorded_at)}
            </Text>
          </View>
        </View>

        <View style={styles.paidBanner}>
          <Text style={styles.paidText}>
            {fullyPaid ? '✓ Payment received in full — thank you.' : '✓ Payment received — thank you.'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text>Invoice</Text>
          <Text>{stripDocYear(invoice.invoice_number)}</Text>
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
