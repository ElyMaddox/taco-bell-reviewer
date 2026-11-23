import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
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

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [locations, setLocations] = useState<LocationStat[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)
  const [myName, setMyName] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadLocations = useCallback(async () => {
    const { data } = await supabase.from('location_stats').select('*')
    if (data) setLocations(data as LocationStat[])
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
        <MapContainer center={[39.5, -98.35]} zoom={4} className="map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyTo target={flyTarget} />
          {locations.map((l) => (
            <CircleMarker
              key={l.id}
              center={[l.lat, l.lng]}
              radius={selected === l.id ? 12 : 9}
              pathOptions={{ color: '#2b1055', weight: 2, fillColor: scoreColor(l.avg_score), fillOpacity: 0.95 }}
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
