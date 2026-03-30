import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(payload.error || 'Request failed')
  }

  return response.json()
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function severityTone(value) {
  if (value === 'high') return 'tone-high'
  if (value === 'medium') return 'tone-medium'
  return 'tone-low'
}

function statusTone(value) {
  if (value === 'error') return 'tone-high'
  if (value === 'inactive') return 'tone-medium'
  return 'tone-good'
}

function AlertCard({ alert, onResolve }) {
  return (
    <article className="alert-card">
      <div className="alert-card__header">
        <span className={`pill ${severityTone(alert.severity)}`}>{alert.severity}</span>
        <span className="alert-card__time">{formatDate(alert.created_at)}</span>
      </div>
      <h3>{alert.camera_name}</h3>
      <p>{alert.camera_location}</p>
      <dl className="detail-grid">
        <div>
          <dt>Event</dt>
          <dd>{alert.event_type}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{alert.resolved ? 'Resolved' : 'Open'}</dd>
        </div>
        <div>
          <dt>Vehicle</dt>
          <dd>{alert.plate ? `${alert.plate} / ${alert.vehicle_type}` : 'Not detected'}</dd>
        </div>
        <div>
          <dt>Appearances</dt>
          <dd>{alert.appearance_count || 0}</dd>
        </div>
      </dl>
      {!alert.resolved && (
        <button className="button button--ghost" onClick={() => onResolve(alert.id)}>
          Resolve alert
        </button>
      )}
    </article>
  )
}

function DashboardPage({ cameras, alerts, onSimulate, onResolve, simulationBusy, connectionState }) {
  const openAlerts = alerts.filter((alert) => !alert.resolved)

  return (
    <section className="page-grid">
      <div className="page-grid__main">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Security operations</p>
            <h1>Live CCTV alerts with recurring vehicle tracking</h1>
            <p className="hero-copy">
              Monitor entrances, parking zones, and repeated vehicle sightings from one dashboard.
            </p>
          </div>
          <div className="hero-panel__actions">
            <button className="button" onClick={() => onSimulate({ type: 'vehicle' })} disabled={simulationBusy}>
              Simulate vehicle event
            </button>
            <button className="button button--ghost" onClick={() => onSimulate({ type: 'motion' })} disabled={simulationBusy}>
              Simulate motion event
            </button>
            <div className="stream-indicator">
              <span className={`stream-indicator__dot ${connectionState === 'live' ? 'is-live' : 'is-idle'}`}></span>
              <span>{connectionState === 'live' ? 'Live stream connected' : 'Waiting for stream'}</span>
            </div>
          </div>
        </section>

        <section className="camera-grid">
          {cameras.map((camera) => (
            <article className="camera-card" key={camera.id}>
              <div className="camera-card__header">
                <div>
                  <p className="camera-card__name">{camera.name}</p>
                  <p className="camera-card__location">{camera.location}</p>
                </div>
                <span className={`pill ${statusTone(camera.status)}`}>{camera.status}</span>
              </div>
              <p className="metric-label">Open alerts</p>
              <p className="metric-value">{camera.open_alerts}</p>
            </article>
          ))}
        </section>
      </div>

      <aside className="page-grid__side">
        <div className="panel-heading">
          <h2>Open alerts</h2>
          <span>{openAlerts.length}</span>
        </div>
        <div className="stack-list">
          {openAlerts.length ? openAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onResolve={onResolve} />
          )) : <div className="empty-state">No active alerts</div>}
        </div>
      </aside>
    </section>
  )
}

function VehiclesPage({ vehicles }) {
  const leadVehicle = vehicles[0]

  return (
    <section className="content-stack">
      <div className="panel panel--highlight">
        <div>
          <p className="eyebrow">Vehicle registry</p>
          <h1>Recurring plates and vehicle signatures</h1>
        </div>
        <div className="spotlight">
          <span className="spotlight__label">Most frequent</span>
          <strong>{leadVehicle ? leadVehicle.plate : 'No data yet'}</strong>
          <span>{leadVehicle ? `${leadVehicle.color} ${leadVehicle.type} • ${leadVehicle.appearance_count} sightings` : 'Run a simulation to populate the registry'}</span>
        </div>
      </div>

      <div className="table-card">
        <div className="panel-heading">
          <h2>Vehicle appearances</h2>
          <span>{vehicles.length}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Plate</th>
              <th>Color</th>
              <th>Type</th>
              <th>Appearances</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id}>
                <td>{vehicle.plate}</td>
                <td>{vehicle.color}</td>
                <td>{vehicle.type}</td>
                <td>{vehicle.appearance_count}</td>
                <td>{formatDate(vehicle.last_seen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AlertsPage({ events, filters, onFilterChange, onResolve, alerts }) {
  return (
    <section className="content-stack">
      <div className="panel panel--filters">
        <div>
          <p className="eyebrow">Alert history</p>
          <h1>Event log by camera and incident type</h1>
        </div>
        <div className="filters">
          <input
            name="camera_id"
            placeholder="Camera ID"
            value={filters.camera_id}
            onChange={onFilterChange}
          />
          <select name="type" value={filters.type} onChange={onFilterChange}>
            <option value="">All events</option>
            <option value="motion">Motion</option>
            <option value="vehicle">Vehicle</option>
          </select>
          <input
            type="date"
            name="from"
            value={filters.from}
            onChange={onFilterChange}
          />
          <input
            type="date"
            name="to"
            value={filters.to}
            onChange={onFilterChange}
          />
        </div>
      </div>

      <div className="table-card">
        <div className="panel-heading">
          <h2>Events</h2>
          <span>{events.length}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Camera</th>
              <th>Event</th>
              <th>Severity</th>
              <th>Vehicle</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const linkedAlert = alerts.find((alert) => alert.id === event.alert_id)

              return (
                <tr key={event.id}>
                  <td>{formatDate(event.timestamp)}</td>
                  <td>{event.camera_name}</td>
                  <td>{event.type}</td>
                  <td>
                    <span className={`pill ${severityTone(event.severity)}`}>{event.severity || 'n/a'}</span>
                  </td>
                  <td>{event.plate ? `${event.plate} / ${event.vehicle_type}` : 'Not detected'}</td>
                  <td>
                    {linkedAlert && !linkedAlert.resolved ? (
                      <button className="link-button" onClick={() => onResolve(linkedAlert.id)}>
                        Resolve
                      </button>
                    ) : 'Closed'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function App() {
  const [cameras, setCameras] = useState([])
  const [alerts, setAlerts] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [simulationBusy, setSimulationBusy] = useState(false)
  const [connectionState, setConnectionState] = useState('idle')
  const [filters, setFilters] = useState({
    camera_id: '',
    type: '',
    from: '',
    to: '',
  })

  const stats = useMemo(() => ({
    camerasOnline: cameras.filter((camera) => camera.status === 'active').length,
    openAlerts: alerts.filter((alert) => !alert.resolved).length,
    trackedVehicles: vehicles.length,
  }), [alerts, cameras, vehicles])

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true)

      try {
        const params = new URLSearchParams()

        if (filters.camera_id) params.set('camera_id', filters.camera_id)
        if (filters.type) params.set('type', filters.type)
        if (filters.from) params.set('from', filters.from)
        if (filters.to) params.set('to', filters.to)

        const [cameraResponse, alertResponse, vehicleResponse, eventResponse] = await Promise.all([
          request('/api/cameras'),
          request('/api/alerts?limit=20'),
          request('/api/vehicles?sort=appearances&limit=50'),
          request(`/api/events?limit=50${params.toString() ? `&${params.toString()}` : ''}`),
        ])

        setCameras(cameraResponse.data)
        setAlerts(alertResponse.data)
        setVehicles(vehicleResponse.data)
        setEvents(eventResponse.data)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [filters, reloadKey])

  useEffect(() => {
    const stream = new EventSource(`${API_BASE_URL}/api/alerts/stream`)

    stream.addEventListener('connected', () => {
      setConnectionState('live')
    })

    stream.addEventListener('alert', (event) => {
      const payload = JSON.parse(event.data)
      setAlerts((current) => {
        const deduped = current.filter((item) => item.id !== payload.id)
        return [payload, ...deduped]
      })
      setEvents((current) => {
        if (!payload.event_id) {
          return current
        }

        const nextEvent = {
          id: payload.event_id,
          type: payload.event_type,
          timestamp: payload.timestamp,
          camera_name: payload.camera_name,
          camera_location: payload.camera_location,
          alert_id: payload.id,
          severity: payload.severity,
          resolved: payload.resolved,
          plate: payload.plate,
          vehicle_type: payload.vehicle_type,
        }
        const deduped = current.filter((item) => item.id !== nextEvent.id)
        return [nextEvent, ...deduped]
      })
      setCameras((current) => current.map((camera) => (
        camera.id === payload.camera_id
          ? { ...camera, open_alerts: Number(camera.open_alerts) + (payload.resolved ? 0 : 1) }
          : camera
      )))
      setVehicles((current) => {
        if (!payload.vehicle_id) {
          return current
        }

        const existing = current.find((item) => item.id === payload.vehicle_id)
        if (existing) {
          return current
            .map((item) => item.id === payload.vehicle_id
              ? { ...item, appearance_count: payload.appearance_count, last_seen: payload.timestamp }
              : item)
            .sort((left, right) => right.appearance_count - left.appearance_count)
        }

        return current
      })
    })

    stream.onerror = () => {
      setConnectionState('idle')
    }

    return () => {
      stream.close()
    }
  }, [])

  async function handleSimulate(body) {
    setSimulationBusy(true)

    try {
      await request('/api/simulate', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setReloadKey((value) => value + 1)
    } finally {
      setSimulationBusy(false)
    }
  }

  async function handleResolve(alertId) {
    await request(`/api/alerts/${alertId}/resolve`, { method: 'PATCH' })
    setReloadKey((value) => value + 1)
  }

  function handleFilterChange(event) {
    const nextFilters = {
      ...filters,
      [event.target.name]: event.target.value,
    }

    setFilters(nextFilters)
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SentryLog</p>
          <h2 className="topbar__title">CCTV alert dashboard</h2>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav__link is-active' : 'nav__link'}>
            Dashboard
          </NavLink>
          <NavLink to="/vehicles" className={({ isActive }) => isActive ? 'nav__link is-active' : 'nav__link'}>
            Vehicles
          </NavLink>
          <NavLink to="/alerts" className={({ isActive }) => isActive ? 'nav__link is-active' : 'nav__link'}>
            Alerts
          </NavLink>
        </nav>
      </header>

      <section className="summary-bar">
        <article className="summary-card">
          <span>Cameras online</span>
          <strong>{stats.camerasOnline}</strong>
        </article>
        <article className="summary-card">
          <span>Open alerts</span>
          <strong>{stats.openAlerts}</strong>
        </article>
        <article className="summary-card">
          <span>Tracked vehicles</span>
          <strong>{stats.trackedVehicles}</strong>
        </article>
      </section>

      {loading ? (
        <main className="loading-state">Loading dashboard data...</main>
      ) : (
        <main>
          <Routes>
            <Route
              path="/"
              element={
                <DashboardPage
                  cameras={cameras}
                  alerts={alerts}
                  onSimulate={handleSimulate}
                  onResolve={handleResolve}
                  simulationBusy={simulationBusy}
                  connectionState={connectionState}
                />
              }
            />
            <Route path="/vehicles" element={<VehiclesPage vehicles={vehicles} />} />
            <Route
              path="/alerts"
              element={
                <AlertsPage
                  alerts={alerts}
                  events={events}
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onResolve={handleResolve}
                />
              }
            />
          </Routes>
        </main>
      )}
    </div>
  )
}

export default App
