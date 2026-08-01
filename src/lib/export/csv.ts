// Minimal, safe CSV encoder for accounting exports.
//
// Two things a naive `values.join(',')` gets wrong and this doesn't:
//   1. Quoting — cells containing a comma, quote or newline must be wrapped in
//      double quotes with internal quotes doubled (RFC 4180).
//   2. Formula injection — a cell beginning with =, +, -, @, or a tab/CR can be
//      executed as a formula when the file is opened in Excel/Sheets. Contact
//      names and descriptions are attacker-influenced (a lead can name itself
//      `=cmd|...`), so we defuse them with a leading apostrophe.

export type CsvValue = string | number | null | undefined

const INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

/** Encodes a single value into a CSV-safe, injection-safe cell. */
export function csvCell(value: CsvValue): string {
  if (value == null) return ''
  let s = typeof value === 'number' ? String(value) : value

  // Defuse spreadsheet formula injection before quoting.
  if (s.length > 0 && INJECTION_PREFIXES.includes(s[0])) {
    s = `'${s}`
  }

  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Encodes an array of row objects into a CSV string with a header row.
 * `columns` fixes the column order and the header labels; a missing key in a
 * row becomes an empty cell.
 */
export function toCsv<T extends Record<string, CsvValue>>(rows: T[], columns: (keyof T & string)[]): string {
  const header = columns.map(csvCell).join(',')
  const body = rows.map((row) => columns.map((c) => csvCell(row[c])).join(',')).join('\r\n')
  return body ? `${header}\r\n${body}\r\n` : `${header}\r\n`
}

/** Formats a dollar amount to a plain 2dp string (no symbol, no thousands sep). */
export function money2(dollars: number): string {
  return (Math.round(dollars * 100) / 100).toFixed(2)
}
