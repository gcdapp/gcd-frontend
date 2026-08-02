'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from './api'

const AuthContext = createContext({
  user: null, loading: true, error: null,
  login: async () => ({ ok: false }),
  logout: () => {}
})

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    // Only runs client-side, so localStorage is safe here
    const stored = localStorage.getItem('gcd_user')
    const token  = localStorage.getItem('gcd_token')
    if (stored && token) {
      try { setUser(JSON.parse(stored)) } catch {}
      // Render the dashboard immediately from the cached profile instead of making
      // every navigation sit through a "Loading…" splash for this round-trip — it
      // still runs, just in the background, to catch a revoked/expired session and
      // refresh the cached profile.
      setLoading(false)
      authApi.me()
        .then(d => {
          setUser(d.user)
          localStorage.setItem('gcd_user', JSON.stringify(d.user))
        })
        .catch(() => {
          localStorage.removeItem('gcd_token')
          localStorage.removeItem('gcd_user')
          setUser(null)
        })
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email, password) {
    setLoading(true); setError(null)
    try {
      const { token, user: u } = await authApi.login(email, password)
      localStorage.setItem('gcd_token', token)
      localStorage.setItem('gcd_user', JSON.stringify(u))
      setUser(u); setLoading(false)
      return { ok: true, role: u.role }
    } catch (err) {
      setError(err.message || 'Invalid credentials')
      setLoading(false)
      return { ok: false }
    }
  }

  function logout() {
    localStorage.removeItem('gcd_token')
    localStorage.removeItem('gcd_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Safe hook — never returns null, always returns the default context shape
export const useAuth = () => useContext(AuthContext)
