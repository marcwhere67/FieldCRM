'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Zap, CheckCircle, AlertCircle } from 'lucide-react'

export default function SetupPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; message?: string; credentials?: Record<string, { email: string; password: string; role: string }>; error?: string } | null>(null)

  async function runSetup() {
    setLoading(true)
    try {
      const res = await fetch('/api/setup', { method: 'POST' })
      const text = await res.text()
      try {
        setResult(JSON.parse(text))
      } catch {
        setResult({ error: `Server returned non-JSON (status ${res.status}): ${text.slice(0, 500)}` })
      }
    } catch (err) {
      setResult({ error: String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-white text-xl">FieldCRM Setup</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            This will seed the database with a demo organisation, 3 users, 10 contacts, 5 services, jobs, quotes, and invoices.
            Requires your Supabase credentials to be configured in <code className="text-indigo-400">.env.local</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!result && (
            <Button
              onClick={runSetup}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Seeding database...' : 'Run Setup'}
            </Button>
          )}

          {result?.success && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{result.message}</span>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                <p className="text-slate-300 text-sm font-medium">Demo Credentials</p>
                {result.credentials && Object.values(result.credentials).map((cred) => (
                  <div key={cred.email} className="text-sm space-y-0.5">
                    <p className="text-white font-medium capitalize">{cred.role}</p>
                    <p className="text-slate-400">{cred.email} / <span className="text-indigo-400 font-mono">{cred.password}</span></p>
                  </div>
                ))}
              </div>
              <a
                href="/login"
                className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Go to Login →
              </a>
            </div>
          )}

          {result?.error && (
            <div className="flex items-start gap-2 text-red-400 bg-red-950/30 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Setup failed</p>
                <p className="text-xs mt-1 text-red-300">{result.error}</p>
              </div>
            </div>
          )}

          <div className="border-t border-slate-800 pt-4">
            <p className="text-slate-500 text-xs">
              <strong className="text-slate-400">Required env vars:</strong> NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
            </p>
            <p className="text-slate-500 text-xs mt-1">
              Run the SQL schema first from <code className="text-indigo-400">supabase/schema.sql</code> in your Supabase SQL editor.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
