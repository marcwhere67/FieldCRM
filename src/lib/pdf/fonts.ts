import { Font } from '@react-pdf/renderer'
import path from 'path'

// Register the same serif the CRM uses on screen (Cormorant Garamond) so the
// PDF letterhead matches the in-app document. Idempotent — safe to call per render.
let registered = false

export const SERIF = 'Cormorant'

export function registerPdfFonts() {
  if (registered) return
  const dir = path.join(process.cwd(), 'public', 'fonts')
  Font.register({
    family: SERIF,
    fonts: [
      { src: path.join(dir, 'CormorantGaramond-Regular.ttf'), fontWeight: 'normal' },
      { src: path.join(dir, 'CormorantGaramond-SemiBold.ttf'), fontWeight: 'semibold' },
    ],
  })
  registered = true
}
