import { useState } from 'react'
import { supabase, type LocationStat } from './supabase'

type Result = { place_id: number; display_name: string; lat: string; lon: string }

export default function AddLocation({ existing, onClose, onAdded }: {
  existing: LocationStat[]
  onClose: () => void
  onAdded: (id: number, lat: number, lng: number) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    setBusy(true)
    setErr(null)
    try {
      // Free OpenStreetMap geocoder; searched only on submit to respect its usage policy.
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=us&limit=6&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      setResults(await res.json())
    } catch {
      setErr('Address search failed. Try again in a moment.')
    }
    setBusy(false)
  }

  async function pick(r: Result) {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    const dupe = existing.find((l) => Math.abs(l.lat - lat) < 0.0005 && Math.abs(l.lng - lng) < 0.0005)
    if (dupe) return onAdded(dupe.id, dupe.lat, dupe.lng)
    setBusy(true)
    const { data, error } = await supabase
      .from('locations')
      .insert({ address: r.display_name.replace(/^Taco Bell,\s*/i, ''), lat, lng })
      .select('id')
      .single()
    setBusy(false)
    if (error) return setErr(error.message)
    onAdded(data.id, lat, lng)
  }

  return (
    <div>
      <div className="panel-head">
        <h2>Add a Taco Bell</h2>
        <button className="link" onClick={onClose}>✕</button>
      </div>
      <form onSubmit={search} className="row">
        <input autoFocus placeholder='e.g. "Taco Bell Austin TX" or a street address' value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primary" disabled={busy}>Search</button>
      </form>
      {err && <p className="msg">{err}</p>}
      {results && results.length === 0 && <p className="muted">No matches. Try adding the city and state, or use the street address.</p>}
      <ul className="results">
        {results?.map((r) => (
          <li key={r.place_id}>
            <button className="result" disabled={busy} onClick={() => pick(r)}>{r.display_name}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
