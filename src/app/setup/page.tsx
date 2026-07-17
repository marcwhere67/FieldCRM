import { notFound } from 'next/navigation'

// The one-time seeding UI is retired now the app is live. The underlying
// /api/setup endpoint is disabled unless ALLOW_SETUP is explicitly set on the
// server. This page 404s so it isn't a public entry point.
export default function SetupPage() {
  notFound()
}
