'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password: password.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Login failed. Please check your credentials.')
        return
      }

      // Store token for API calls
      if (data.token) {
        localStorage.setItem('admin_token', data.token)
      }

      router.push('/admin')
    } catch (err: any) {
      setError('Unable to connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center">
      <div className="card p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary-800 flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg font-bold">CL</span>
          </div>
          <h1 className="text-lg font-bold text-slate-800">Admin Login</h1>
          <p className="text-xs text-slate-500 mt-1">
            Sign in to access the hostel laundry management console
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError('') }}
              placeholder="Enter username"
              className="input-field"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="Enter password"
              className="input-field"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-2.5"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-[11px] text-slate-400 text-center mt-5">
          Forgot your password? Contact the IT department.
        </p>
      </div>
    </div>
  )
}
