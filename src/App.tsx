import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { supabase, scoreColor, type LocationStat } from './supabase'
import Auth from './Auth'
import AddLocation from './AddLocation'
import LocationPanel from './LocationPanel'

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 13))
  }, [target, map])
  return null
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) })
  return null
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [locations, setLocations] = useState<LocationStat[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)
  const [myName, setMyName] = useState('')
  const [zoom, setZoom] = useState(4)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadLocations = useCallback(async () => {
    // The API returns at most 1,000 rows per request, so page through all stores.
    const all: LocationStat[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('location_stats').select('*').order('id').range(from, from + 999)
      if (error || !data) break
      all.push(...(data as LocationStat[]))
      if (data.length < 1000) break
    }
    setLocations(all)
  }, [])

  useEffect(() => {
    if (!session) return
    loadLocations()
    supabase.from('profiles').select('display_name').eq('id', session.user.id).single()
      .then(({ data }) => setMyName(data?.display_name ?? ''))
  }, [session, loadLocations])

  if (!ready) return null
  if (!session) return <Auth />

  const current = locations.find((l) => l.id === selected) ?? null

  return (
    <div className="app">
      <header>
        <strong>🌮 Taco Bell Reviewer</strong>
        <span className="spacer" />
        <button className="primary" onClick={() => { setAdding(true); setSelected(null) }}>+ Add location</button>
        <span className="muted who">{myName}</span>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>
      <main>
        <MapContainer center={[39.5, -98.35]} zoom={4} className="map" preferCanvas>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyTo target={flyTarget} />
          <ZoomWatcher onZoom={setZoom} />
          {/* draw reviewed stores last so they sit on top of unrated ones */}
          {[...locations].sort((a, b) => a.review_count - b.review_count).map((l) => (
            <CircleMarker
              key={l.id}
              center={[l.lat, l.lng]}
              radius={selected === l.id ? 11 : l.review_count > 0 ? (zoom < 7 ? 5 : 7) : zoom < 6 ? 2 : zoom < 9 ? 3.5 : 5}
              pathOptions={{ color: '#2b1055', weight: l.review_count > 0 ? 2 : zoom < 6 ? 0 : 1, fillColor: scoreColor(l.avg_score), fillOpacity: l.review_count > 0 ? 0.95 : 0.6 }}
              eventHandlers={{ click: () => { setSelected(l.id); setAdding(false) } }}
            >
              <Tooltip>
                {l.address}<br />
                {l.avg_score != null ? `${l.avg_score} / 5 · ${l.review_count} reviews` : 'No reviews yet'}
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
        {(adding || current) && (
          <aside className="panel">
            {adding ? (
              <AddLocation
                existing={locations}
                onClose={() => setAdding(false)}
                onAdded={async (id, lat, lng) => {
                  await loadLocations()
                  setAdding(false)
                  setSelected(id)
                  setFlyTarget([lat, lng])
                }}
              />
            ) : current && (
              <LocationPanel
                key={current.id}
                location={current}
                userId={session.user.id}
                onClose={() => setSelected(null)}
                onChanged={loadLocations}
              />
            )}
          </aside>
        )}
        {locations.length === 0 && !adding && (
          <div className="empty card">No Taco Bells yet. Click <b>+ Add location</b> to add the first one.</div>
        )}
        <div className="legend card">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s}><i style={{ background: scoreColor(s) }} />{s}</span>
          ))}
          <span><i style={{ background: scoreColor(null) }} />unrated</span>
        </div>
      </main>
    </div>
  )
}
