import { useEffect, useMemo, useState } from 'react'
import { supabase, scoreColor, type LocationStat, type MenuItem, type Review } from './supabase'

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

type Sort = 'newest' | 'highest' | 'lowest'

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span className="stars-static" style={{ fontSize: size }} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      <span className="stars-bg">★★★★★</span>
      <span className="stars-fg" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  )
}

function relativeDate(iso: string) {
  const d = new Date(iso + 'T00:00')
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`
  return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`
}

function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 55% 45%)`
}

export default function LocationPanel({ location, userId, onClose, onChanged }: {
  location: LocationStat
  userId: string
  onClose: () => void
  onChanged: () => void
}) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [writing, setWriting] = useState(false)
  const [sort, setSort] = useState<Sort>('newest')
  const [itemFilter, setItemFilter] = useState<string | null>(null)

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

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.score, 0) / reviews.length : 0

  const histogram = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]
    for (const r of reviews) counts[r.score - 1]++
    return counts
  }, [reviews])

  const byItem = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>()
    for (const r of reviews) {
      const k = r.menu_items?.name ?? '?'
      const v = m.get(k) ?? { sum: 0, n: 0 }
      v.sum += r.score; v.n++
      m.set(k, v)
    }
    return [...m.entries()].map(([name, v]) => ({ name, avg: v.sum / v.n, n: v.n })).sort((a, b) => b.n - a.n || b.avg - a.avg)
  }, [reviews])

  const shown = useMemo(() => {
    const list = itemFilter ? reviews.filter((r) => r.menu_items?.name === itemFilter) : [...reviews]
    if (sort === 'highest') list.sort((a, b) => b.score - a.score || b.visited_on.localeCompare(a.visited_on))
    if (sort === 'lowest') list.sort((a, b) => a.score - b.score || b.visited_on.localeCompare(a.visited_on))
    return list
  }, [reviews, sort, itemFilter])

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

  function resetForm() {
    setScore(0); setNotes(''); setNewItem(''); setItemId(''); setVisited(today()); setErr(null)
  }

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
    resetForm()
    setWriting(false)
    setSort('newest')
    setItemFilter(null)
    await load()
    onChanged()
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this review?')) return
    await supabase.from('reviews').delete().eq('id', id)
    await load()
    onChanged()
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Taco Bell ' + location.address)}`

  return (
    <div className="lp">
      <div className="lp-hero">
        <button className="lp-close" onClick={onClose} aria-label="Close">✕</button>
        <h2>{location.name}</h2>
        <p className="muted small">{location.address}</p>
        <a className="small" href={mapsUrl} target="_blank" rel="noreferrer">Directions ↗</a>
      </div>

      <section className="lp-summary">
        <div className="lp-score">
          <div className="lp-avg">{reviews.length ? avg.toFixed(1) : '–'}</div>
          <Stars value={avg} size={18} />
          <div className="muted small">{reviews.length} review{reviews.length === 1 ? '' : 's'}</div>
        </div>
        <div className="lp-hist">
          {[5, 4, 3, 2, 1].map((s) => {
            const n = histogram[s - 1]
            const pct = reviews.length ? (n / reviews.length) * 100 : 0
            return (
              <div className="lp-hist-row" key={s}>
                <span className="small">{s}</span>
                <div className="lp-bar"><div style={{ width: `${pct}%`, background: scoreColor(s) }} /></div>
              </div>
            )
          })}
        </div>
      </section>

      {!writing ? (
        <button className="lp-write" onClick={() => setWriting(true)}>✎ Write a review</button>
      ) : (
        <form onSubmit={submit} className="lp-form">
          <div className="row-between">
            <h3>Your review</h3>
            <button type="button" className="link" onClick={() => { setWriting(false); resetForm() }}>Cancel</button>
          </div>
          <div className="stars-input" role="radiogroup" aria-label="Score">
            {[1, 2, 3, 4, 5].map((s) => (
              <button type="button" key={s} aria-checked={score === s} role="radio" aria-label={`${s} star${s > 1 ? 's' : ''}`}
                className={s <= score ? 'on' : ''} onClick={() => setScore(s)}>★</button>
            ))}
          </div>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
            <option value="">What did you eat or drink?</option>
            {groups.map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </optgroup>
            ))}
            <option value="new">+ Something else…</option>
          </select>
          {itemId === 'new' && <input placeholder="Item name" value={newItem} onChange={(e) => setNewItem(e.target.value)} maxLength={60} />}
          <textarea placeholder="Share details of your experience (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} />
          <label className="small muted">Visit date
            <input type="date" value={visited} max={today()} onChange={(e) => setVisited(e.target.value)} required />
          </label>
          <button className="primary" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
          {err && <p className="msg">{err}</p>}
        </form>
      )}

      <section className="lp-reviews">
        <div className="row-between">
          <h3>Reviews</h3>
          <select className="lp-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort reviews">
            <option value="newest">Newest</option>
            <option value="highest">Highest</option>
            <option value="lowest">Lowest</option>
          </select>
        </div>

        {byItem.length > 1 && (
          <div className="chips">
            <button className={itemFilter === null ? 'chip on' : 'chip'} onClick={() => setItemFilter(null)}>All</button>
            {byItem.map((i) => (
              <button key={i.name} className={itemFilter === i.name ? 'chip on' : 'chip'} onClick={() => setItemFilter(itemFilter === i.name ? null : i.name)}>
                {i.name} <span style={{ color: scoreColor(i.avg) }}>★ {i.avg.toFixed(1)}</span> <span className="muted">({i.n})</span>
              </button>
            ))}
          </div>
        )}

        {reviews.length === 0 && <p className="muted">No reviews yet. Be the first!</p>}
        <ul className="review-list">
          {shown.map((r) => {
            const name = r.profiles?.display_name ?? 'Someone'
            return (
              <li key={r.id} className="review">
                <div className="review-head">
                  <span className="avatar" style={{ background: avatarColor(name) }}>{name.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <div className="review-name">{name}{r.user_id === userId && <span className="muted small"> (you)</span>}</div>
                    <div className="muted small">{r.menu_items?.name}</div>
                  </div>
                  {r.user_id === userId && <button className="link small review-del" onClick={() => remove(r.id)}>Delete</button>}
                </div>
                <div className="review-meta">
                  <Stars value={r.score} size={14} />
                  <span className="muted small" title={new Date(r.visited_on + 'T00:00').toLocaleDateString()}>{relativeDate(r.visited_on)}</span>
                </div>
                {r.notes && <p className="note">{r.notes}</p>}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
