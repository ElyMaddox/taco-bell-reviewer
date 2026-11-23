import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    if (mode === 'up') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
      })
      if (error) setMsg(error.message)
      else if (!data.session) setMsg('Check your email to confirm your account, then sign in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg(error.message)
    }
    setBusy(false)
  }

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1>🌮 Taco Bell Reviewer</h1>
        <p className="muted">Rate every Taco Bell you and your friends visit.</p>
        {mode === 'up' && (
          <label>
            Display name
            <input required value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
        )}
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="primary" disabled={busy}>{mode === 'in' ? 'Sign in' : 'Create account'}</button>
        {msg && <p className="msg">{msg}</p>}
        <button type="button" className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>
          {mode === 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
