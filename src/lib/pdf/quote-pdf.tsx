import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import path from 'path'
import { registerPdfFonts, SERIF } from './fonts'

registerPdfFonts()

const LOGO_PATH = path.join(process.cwd(), 'public', 'salt-air-logo.png')

const NAVY = '#2C3E50'
const SAGE = '#76A58F'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
    padding: 48,
    backgroundColor: '#ffffff',
  },
  brandRule: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: NAVY,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  logo: {
    width: 100,
    height: 'auto',
    marginBottom: 10,
  },
  orgName: {
    fontFamily: SERIF,
    fontWeight: 'normal',
    fontSize: 20,
    color: NAVY,
    marginBottom: 4,
  },
  orgContact: {
    fontSize: 9,
    color: '#64748b',
    lineHeight: 1.6,
  },
  docLabel: {
    fontSize: 9,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'right',
  },
  docTitle: {
    fontFamily: SERIF,
    fontWeight: 'semibold',
    fontSize: 26,
    color: NAVY,
    textAlign: 'right',
    marginTop: 2,
  },
  docMeta: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 8,
    lineHeight: 1.6,
  },
  divider: {
    borderBottom: '1pt solid #e2e8f0',
    marginBottom: 18,
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  billTo: {
    fontSize: 10,
    color: '#1e293b',
    lineHeight: 1.6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    padding: '8 10',
    marginBottom: 2,
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    padding: '8 10',
    borderBottom: '1pt solid #f1f5f9',
  },
  tableCell: {
    fontSize: 10,
    color: '#334155',
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1.5, textAlign: 'right' },
  colTotal: { flex: 1.5, textAlign: 'right' },
  totalsSection: {
    alignItems: 'flex-end',
    marginTop: 16,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    marginBottom: 4,
  },
  totalsLabel: {
    fontSize: 9,
    color: '#64748b',
  },
  totalsValue: {
    fontSize: 9,
    color: '#334155',
  },
  totalDivider: {
    borderBottom: '1pt solid #e2e8f0',
    width: 220,
    marginBottom: 8,
    marginTop: 4,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontFamily: SERIF,
    fontWeight: 'semibold',
    color: NAVY,
  },
  grandTotalValue: {
    fontSize: 15,
    fontFamily: SERIF,
    fontWeight: 'semibold',
    color: SAGE,
  },
  depositRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    marginTop: 8,
    backgroundColor: '#fefce8',
    padding: '6 8',
    borderRadius: 4,
  },
  depositLabel: {
    fontSize: 9,
    color: '#854d0e',
    fontFamily: 'Helvetica-Bold',
  },
  depositValue: {
    fontSize: 9,
    color: '#854d0e',
    fontFamily: 'Helvetica-Bold',
  },
  notes: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#eef4f0',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#cfe0d6',
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#3f6b57',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: '#3f6b57',
    lineHeight: 1.6,
  },
  statusBadge: {
    padding: '4 10',
    borderRadius: 20,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  statusText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
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

function formatCurrency(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatDate(s: string | null | undefined) {
  if (!s) return '—'
  const d = new Date(s)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

interface LineItem {
  description: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface Props {
  quote: {
    quote_number: string
    status: string
    line_items: LineItem[]
    subtotal: number
    tax: number
    total: number
    notes_client: string | null
    valid_until: string | null
    deposit_amount: number | null
    created_at: string
  }
  org: {
    name: string
    phone: string | null
    email: string | null
    address: string | null
    abn: string | null
  }
  contact: {
    first_name: string
    last_name: string
    email: string
    address_line1: string | null
    suburb: string | null
    state: string | null
    postcode: string | null
  }
}

export function QuotePDF({ quote, org, contact }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandRule} fixed />
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Image src={LOGO_PATH} style={styles.logo} />
            <Text style={styles.orgName}>{org.name}</Text>
            <Text style={styles.orgContact}>
              {org.abn ? `ABN ${org.abn}\n` : ''}{org.email ?? ''}{org.phone ? `\n${org.phone}` : ''}
            </Text>
          </View>
          <View>
            <Text style={styles.docLabel}>Quote</Text>
            <Text style={styles.docTitle}>{quote.quote_number}</Text>
            <Text style={styles.docMeta}>
              Quote date: {formatDate(quote.created_at)}{'\n'}
              {quote.valid_until ? `Expiry date: ${formatDate(quote.valid_until)}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill to */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Prepared for</Text>
          <Text style={styles.billTo}>
            {contact.first_name} {contact.last_name}{'\n'}
            {contact.email}
            {contact.address_line1 ? `\n${contact.address_line1}` : ''}
            {contact.suburb ? `\n${contact.suburb}${contact.state ? ` ${contact.state}` : ''}${contact.postcode ? ` ${contact.postcode}` : ''}` : ''}
          </Text>
        </View>

        {/* Line items */}
        <View style={styles.section}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
          </View>
          {quote.line_items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colDesc]}>{item.description}</Text>
              <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.colPrice]}>{formatCurrency(item.unit_price)}</Text>
              <Text style={[styles.tableCell, styles.colTotal]}>{formatCurrency(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          {quote.tax > 0 && (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal</Text>
                <Text style={styles.totalsValue}>{formatCurrency(quote.subtotal)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>GST (10%)</Text>
                <Text style={styles.totalsValue}>{formatCurrency(quote.tax)}</Text>
              </View>
            </>
          )}
          <View style={styles.totalDivider} />
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(quote.total)}</Text>
          </View>
          {quote.deposit_amount && quote.deposit_amount > 0 && (
            <View style={styles.depositRow}>
              <Text style={styles.depositLabel}>Deposit required to book</Text>
              <Text style={styles.depositValue}>{formatCurrency(quote.deposit_amount)}</Text>
            </View>
          )}
        </View>

        {/* How to accept */}
        <View style={styles.notes}>
          <Text style={styles.notesLabel}>How to accept this quote</Text>
          <Text style={styles.notesText}>
            Use the approval link in your email{org.phone ? `, or call us on ${org.phone}` : ''}
            {org.email ? `, or reply to ${org.email}` : ''}.
            {quote.valid_until ? ` This quote is valid until ${formatDate(quote.valid_until)}.` : ''}
          </Text>
        </View>

        {/* Notes */}
        {quote.notes_client && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{quote.notes_client}</Text>
          </View>
        )}

      </Page>
    </Document>
  )
}
