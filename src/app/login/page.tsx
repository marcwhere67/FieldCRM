'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2, Zap } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const supabase = createClient()

  async function handleEmailLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      window.location.href = '/dashboard'
    }
    setLoading(false)
  }

  async function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      toast.error(error.message)
    } else {
      setMagicLinkSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F5F0EB' }}>
      {/* Left panel — navy brand */}
      <div className="hidden lg:flex flex-col justify-between w-80 shrink-0 p-10" style={{ backgroundColor: '#2C3E50' }}>
        <div>
          <div className="bg-white px-4 py-3 inline-block">
            <img src="/salt-air-logo-web.png" alt="Salt Air Cleaning" className="h-16 w-auto" />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }} className="text-[9px] uppercase mt-3">FieldCRM</p>
        </div>
        <div>
          <blockquote style={{ fontFamily: "var(--font-cormorant, 'Cormorant Garamond', Georgia, serif)", color: 'rgba(255,255,255,0.7)' }} className="text-2xl font-light italic leading-relaxed">
            "Cleaning spaces,<br />elevating lives."
          </blockquote>
          <p style={{ color: 'rgba(255,255,255,0.3)' }} className="text-xs mt-4">Field service & marketing platform</p>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} className="pt-6">
          <p style={{ color: 'rgba(255,255,255,0.2)' }} className="text-[10px]">Salt Air Cleaning · Bass Coast, VIC</p>
        </div>
      </div>

      {/* Right panel — cream form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <img src="/salt-air-logo-web.png" alt="Salt Air Cleaning" className="h-24 w-auto mx-auto" />
          </div>

          <div>
            <h2 style={{ fontFamily: "var(--font-cormorant, 'Cormorant Garamond', Georgia, serif)", color: '#2C3E50' }} className="text-3xl font-light">Welcome back</h2>
            <p style={{ color: '#4A5A65' }} className="text-sm mt-1">Sign in to your workspace</p>
          </div>

          <Card style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.1)' }} className="rounded-none shadow-sm">
            <CardContent className="pt-6">
              <Tabs defaultValue="password" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 rounded-none" style={{ backgroundColor: '#EDE8E2' }}>
                  <TabsTrigger value="password" className="rounded-none text-sm data-[state=active]:text-white" style={{ fontWeight: 400 }}
                    data-state-active-style={{ backgroundColor: '#2C3E50' }}>
                    Password
                  </TabsTrigger>
                  <TabsTrigger value="magic" className="rounded-none text-sm data-[state=active]:text-white" style={{ fontWeight: 400 }}>
                    Magic Link
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="password">
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" style={{ color: '#4A5A65', fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@saltaircleaning.com.au"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="rounded-none h-10 text-sm"
                        style={{ border: '1px solid rgba(44,62,80,0.2)', backgroundColor: '#F5F0EB', color: '#1C2A35' }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password" style={{ color: '#4A5A65', fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="rounded-none h-10 text-sm"
                        style={{ border: '1px solid rgba(44,62,80,0.2)', backgroundColor: '#F5F0EB', color: '#1C2A35' }}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-none h-10 text-sm font-normal tracking-widest uppercase text-white"
                      style={{ backgroundColor: '#2C3E50', letterSpacing: '0.15em' }}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign in
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="magic">
                  {magicLinkSent ? (
                    <div className="text-center py-6 space-y-2">
                      <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(118,165,143,0.12)' }}>
                        <Zap className="w-6 h-6" style={{ color: '#76A58F' }} />
                      </div>
                      <p style={{ color: '#1C2A35' }} className="font-medium">Check your email</p>
                      <p style={{ color: '#4A5A65' }} className="text-sm">
                        We sent a magic link to <span style={{ color: '#76A58F' }}>{email}</span>
                      </p>
                      <Button
                        variant="ghost"
                        style={{ color: '#4A5A65' }}
                        className="hover:text-[#2C3E50] mt-2"
                        onClick={() => setMagicLinkSent(false)}
                      >
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleMagicLink} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="magic-email" style={{ color: '#4A5A65', fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Email</Label>
                        <Input
                          id="magic-email"
                          type="email"
                          placeholder="you@saltaircleaning.com.au"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          className="rounded-none h-10 text-sm"
                          style={{ border: '1px solid rgba(44,62,80,0.2)', backgroundColor: '#F5F0EB', color: '#1C2A35' }}
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-none h-10 text-sm font-normal text-white"
                        style={{ backgroundColor: '#2C3E50', letterSpacing: '0.15em' }}
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send magic link
                      </Button>
                    </form>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
