import { createBrowserClient } from '@supabase/ssr'

const REMEMBER_KEY = 'fieldcrm-remember-me'

// Routes auth storage to localStorage (persists across browser restarts) or
// sessionStorage (cleared when the tab closes) based on the "stay signed in"
// choice made at login. Falls back to localStorage if no choice was made yet.
const conditionalStorage = {
  getItem: (key: string) => {
    const remember = typeof window !== 'undefined' && window.localStorage.getItem(REMEMBER_KEY) !== 'false'
    return (remember ? window.localStorage : window.sessionStorage).getItem(key)
  },
  setItem: (key: string, value: string) => {
    const remember = typeof window !== 'undefined' && window.localStorage.getItem(REMEMBER_KEY) !== 'false'
    ;(remember ? window.localStorage : window.sessionStorage).setItem(key, value)
  },
  removeItem: (key: string) => {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  },
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: conditionalStorage,
      },
    }
  )
}

export function setRememberMe(remember: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
}
