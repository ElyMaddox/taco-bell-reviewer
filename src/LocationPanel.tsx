import { useEffect, useMemo, useState } from 'react'
import { supabase, scoreColor, type LocationStat, type MenuItem, type Review } from './supabase'

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

export default function LocationPanel({ location, userId, onClose, onChanged }: {
  location: LocationStat
  userId: string
  onClose: () => void
  onChanged: () => void
}) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [itemId, setItemId] = useState<string>('')
  const [newItem, setNewItem] = useState('')
  const [score, setScore] = useState(0)
  const [notes, setNotes] = useState('')
  const [visited, setVisited] = useState(today())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    const [r, i] = await Promise.all([
      supabase.from('reviews')
        .select('*, profiles(display_name), menu_items(name)')
        .eq('location_id', location.id)
        .order('visited_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('menu_items').select('id, name, category').order('name'),
    ])
    if (r.data) setReviews(r.data as Review[])
    if (i.data) setItems(i.data)
  }

  useEffect(() => { load() }, [location.id])

  const byItem = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>()
    for (const r of reviews) {
      const k = r.menu_items?.name ?? '?'
      const v = m.get(k) ?? { sum: 0, n: 0 }
      v.sum += r.score; v.n++
      m.set(k, v)
    }
    return [...m.entries()].map(([name, v]) => ({ name, avg: v.sum / v.n, n: v.n })).sort((a, b) => b.avg - a.avg)
  }, [reviews])

  const groups = useMemo(() => {
    const order = ['Tacos', 'Burritos', 'Quesadillas', 'Specialties', 'Bowls', 'Nachos & Sides', 'Sweets', 'Breakfast', 'Drinks']
    const m = new Map<string, MenuItem[]>()
    for (const i of items) {
      const c = i.category ?? 'Other'
      m.set(c, [...(m.get(c) ?? []), i])
    }
    const rank = (c: string) => (order.indexOf(c) + 1 || 99)
    return [...m.entries()].sort((a, b) => rank(a[0]) - rank(b[0]))
  }, [items])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!score) return setErr('Pick a score from 1 to 5.')
    setBusy(true)
    let item = Number(itemId)
    if (itemId === 'new') {
      const name = newItem.trim()
      if (!name) { setBusy(false); return setErr('Type the new item name.') }
      const found = items.find((i) => i.name.toLowerCase() === name.toLowerCase())
      if (found) item = found.id
      else {
        const { data, error } = await supabase.from('menu_items').insert({ name, category: 'Other' }).select('id').single()
        if (error) { setBusy(false); return setErr(error.message) }
        item = data.id
      }
    }
    if (!item) { setBusy(false); return setErr('Pick a menu item.') }
    const { error } = await supabase.from('reviews').insert({
      location_id: location.id, item_id: item, score, notes: notes.trim() || null, visited_on: visited,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setScore(0); setNotes(''); setNewItem(''); setItemId('')
    await load()
    onChanged()
  }

  async function remove(id: number) {
    await supabase.from('reviews').delete().eq('id', id)
    await load()
    onChanged()
  }

  return (
    <div>
      <div className="panel-head">
        <div>
          <h2>{location.name}</h2>
          <p className="muted small">{location.address}</p>
        </div>
        <button className="link" onClick={onClose}>✕</button>
      </div>
      <p className="big" style={{ color: scoreColor(location.avg_score) }}>
        {location.avg_score != null ? `${location.avg_score} / 5` : 'No reviews yet'}
        <span className="muted small"> · {location.review_count} reviews</span>
      </p>

      {byItem.length > 0 && (
        <>
          <h3>By item</h3>
          <ul className="items">
            {byItem.map((i) => (
              <li key={i.name}>
                <span>{i.name}</span>
                <span style={{ color: scoreColor(i.avg) }}>{i.avg.toFixed(1)}</span>
                <span className="muted small">×{i.n}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Add a review</h3>
      <form onSubmit={submit} className="review-form">
        <select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
          <option value="">Menu item…</option>
          {groups.map(([cat, list]) => (
            <optgroup key={cat} label={cat}>
              {list.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </optgroup>
          ))}
          <option value="new">+ Something else…</option>
        </select>
        {itemId === 'new' && <input placeholder="Item name" value={newItem} onChange={(e) => setNewItem(e.target.value)} maxLength={60} />}
        <div className="stars" role="radiogroup" aria-label="Score">
          {[1, 2, 3, 4, 5].map((s) => (
            <button type="button" key={s} aria-checked={score === s} role="radio"
              className={s <= score ? 'on' : ''} onClick={() => setScore(s)}>★</button>
          ))}
        </div>
        <label className="small">Visit date
          <input type="date" value={visited} max={today()} onChange={(e) => setVisited(e.target.value)} required />
        </label>
        <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={2} />
        <button className="primary" disabled={busy}>Save review</button>
        {err && <p className="msg">{err}</p>}
      </form>

      <h3>History</h3>
      {reviews.length === 0 && <p className="muted">Nobody has reviewed this one yet.</p>}
      <ul className="history">
        {reviews.map((r) => (
          <li key={r.id}>
            <div className="row-between">
              <b>{r.menu_items?.name}</b>
              <span style={{ color: scoreColor(r.score) }}>{'★'.repeat(r.score)}<span className="dim">{'★'.repeat(5 - r.score)}</span></span>
            </div>
            <div className="muted small">
              {r.profiles?.display_name ?? 'Someone'} · {new Date(r.visited_on + 'T00:00').toLocaleDateString()}
              {r.user_id === userId && <button className="link small" onClick={() => remove(r.id)}>delete</button>}
            </div>
            {r.notes && <p className="note">{r.notes}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
