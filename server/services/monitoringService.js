const pool = require('../db/pool');
const createHttpError = require('../lib/createHttpError');

const samplePlates = ['ABC-1234', 'VXN-2901', 'HTR-8840', 'JKA-4419', 'PLM-7308', 'QWE-2087'];
const sampleColors = ['gray', 'white', 'black', 'blue', 'silver', 'red'];
const sampleVehicleTypes = ['sedan', 'suv', 'truck', 'motorcycle', 'van'];
const sampleZones = ['entry-lane', 'gate-a', 'walkway', 'parking-row-b', 'north-corner'];

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toRequiredInteger(value, fieldName) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} must be a positive integer`);
  }

  return parsed;
}

function normalizeResolved(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  throw createHttpError(400, 'resolved must be true or false');
}

async function listCameras() {
  const query = `
    SELECT
      c.id,
      c.name,
      c.location,
      c.status,
      c.created_at,
      COUNT(a.id) FILTER (WHERE a.resolved = FALSE) AS open_alerts
    FROM cameras c
    LEFT JOIN alerts a ON a.camera_id = c.id
    GROUP BY c.id
    ORDER BY c.id;
  `;

  const { rows } = await pool.query(query);
  return rows;
}

async function listVehicles({ sort = 'appearances', limit = 50 }) {
  const safeLimit = Math.min(Math.max(toInteger(limit, 50), 1), 100);
  const orderBy = sort === 'recent' ? 'last_seen DESC' : 'appearance_count DESC, last_seen DESC';
  const query = `
    SELECT
      id,
      plate,
      color,
      type,
      appearance_count,
      first_seen,
      last_seen
    FROM vehicles
    ORDER BY ${orderBy}
    LIMIT $1;
  `;

  const { rows } = await pool.query(query, [safeLimit]);
  return rows;
}

async function listEvents({ cameraId, type, from, to, limit = 50 }) {
  const filters = [];
  const values = [];

  if (cameraId) {
    values.push(toRequiredInteger(cameraId, 'camera_id'));
    filters.push(`e.camera_id = $${values.length}`);
  }

  if (type) {
    values.push(type);
    filters.push(`e.type = $${values.length}`);
  }

  if (from) {
    values.push(from);
    filters.push(`e.timestamp >= $${values.length}`);
  }

  if (to) {
    values.push(to);
    filters.push(`e.timestamp <= $${values.length}`);
  }

  values.push(Math.min(Math.max(toInteger(limit, 50), 1), 100));
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const query = `
    SELECT
      e.id,
      e.type,
      e.timestamp,
      e.metadata,
      c.id AS camera_id,
      c.name AS camera_name,
      c.location AS camera_location,
      v.id AS vehicle_id,
      v.plate,
      v.color,
      v.type AS vehicle_type,
      a.id AS alert_id,
      a.severity,
      a.resolved
    FROM events e
    JOIN cameras c ON c.id = e.camera_id
    LEFT JOIN vehicles v ON v.id = e.vehicle_id
    LEFT JOIN alerts a ON a.event_id = e.id
    ${whereClause}
    ORDER BY e.timestamp DESC
    LIMIT $${values.length};
  `;

  const { rows } = await pool.query(query, values);
  return rows;
}

async function listAlerts({ resolved, limit = 20 }) {
  const values = [];
  let whereClause = '';

  if (resolved !== undefined) {
    values.push(resolved);
    whereClause = `WHERE a.resolved = $${values.length}`;
  }

  values.push(Math.min(Math.max(toInteger(limit, 20), 1), 100));
  const query = `
    SELECT
      a.id,
      a.severity,
      a.resolved,
      a.created_at,
      e.id AS event_id,
      e.type AS event_type,
      e.timestamp,
      e.metadata,
      c.id AS camera_id,
      c.name AS camera_name,
      c.location AS camera_location,
      v.id AS vehicle_id,
      v.plate,
      v.color,
      v.type AS vehicle_type,
      v.appearance_count
    FROM alerts a
    JOIN events e ON e.id = a.event_id
    JOIN cameras c ON c.id = a.camera_id
    LEFT JOIN vehicles v ON v.id = e.vehicle_id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT $${values.length};
  `;

  const { rows } = await pool.query(query, values);
  return rows;
}

async function getAlertById(alertId) {
  const query = `
    SELECT
      a.id,
      a.severity,
      a.resolved,
      a.created_at,
      e.id AS event_id,
      e.type AS event_type,
      e.timestamp,
      e.metadata,
      c.id AS camera_id,
      c.name AS camera_name,
      c.location AS camera_location,
      v.id AS vehicle_id,
      v.plate,
      v.color,
      v.type AS vehicle_type,
      v.appearance_count
    FROM alerts a
    JOIN events e ON e.id = a.event_id
    JOIN cameras c ON c.id = a.camera_id
    LEFT JOIN vehicles v ON v.id = e.vehicle_id
    WHERE a.id = $1
    LIMIT 1;
  `;

  const { rows } = await pool.query(query, [alertId]);
  return rows[0] || null;
}

async function resolveAlert(alertId) {
  const safeAlertId = toRequiredInteger(alertId, 'alert_id');
  const query = `
    UPDATE alerts
    SET resolved = TRUE
    WHERE id = $1
    RETURNING id;
  `;
  const { rowCount } = await pool.query(query, [safeAlertId]);

  if (!rowCount) {
    throw createHttpError(404, 'Alert not found');
  }

  return getAlertById(safeAlertId);
}

function buildVehiclePayload(input) {
  const plate = input.plate || pickRandom(samplePlates);
  const color = input.color || pickRandom(sampleColors);
  const type = input.vehicle_type || input.vehicleType || pickRandom(sampleVehicleTypes);

  return {
    plate: String(plate).toUpperCase(),
    color: String(color).toLowerCase(),
    type: String(type).toLowerCase(),
  };
}

async function pickCamera(client, cameraId) {
  if (cameraId) {
    const cameraQuery = await client.query('SELECT id, name, location, status FROM cameras WHERE id = $1;', [toInteger(cameraId)]);
    if (!cameraQuery.rowCount) {
      throw createHttpError(404, 'Camera not found');
    }
    return cameraQuery.rows[0];
  }

  const cameraQuery = await client.query('SELECT id, name, location, status FROM cameras ORDER BY RANDOM() LIMIT 1;');
  if (!cameraQuery.rowCount) {
    throw createHttpError(400, 'No cameras available');
  }
  return cameraQuery.rows[0];
}

async function createSimulation(payload = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const camera = await pickCamera(client, payload.camera_id);
    const eventType = payload.type === 'motion' || payload.type === 'vehicle'
      ? payload.type
      : Math.random() < 0.6
        ? 'vehicle'
        : 'motion';

    let vehicle = null;
    let metadata;
    let severity;

    if (eventType === 'vehicle') {
      const vehiclePayload = buildVehiclePayload(payload);
      const vehicleQuery = await client.query(
        `
          INSERT INTO vehicles (plate, color, type)
          VALUES ($1, $2, $3)
          ON CONFLICT (plate, color, type)
          DO UPDATE SET
            appearance_count = vehicles.appearance_count + 1,
            last_seen = NOW()
          RETURNING id, plate, color, type, appearance_count, first_seen, last_seen;
        `,
        [vehiclePayload.plate, vehiclePayload.color, vehiclePayload.type],
      );

      vehicle = vehicleQuery.rows[0];
      severity = vehicle.appearance_count >= 4 ? 'high' : 'medium';
      metadata = {
        confidence: Math.floor(87 + Math.random() * 12),
        recognition_key: `${vehicle.plate}:${vehicle.color}:${vehicle.type}`,
      };
    } else {
      severity = Math.random() > 0.55 ? 'medium' : 'low';
      metadata = {
        zone: payload.zone || pickRandom(sampleZones),
        confidence: Math.floor(72 + Math.random() * 20),
      };
    }

    const eventQuery = await client.query(
      `
        INSERT INTO events (camera_id, vehicle_id, type, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING id, camera_id, vehicle_id, type, timestamp, metadata;
      `,
      [camera.id, vehicle ? vehicle.id : null, eventType, metadata],
    );

    const event = eventQuery.rows[0];
    const alertQuery = await client.query(
      `
        INSERT INTO alerts (camera_id, event_id, severity)
        VALUES ($1, $2, $3)
        RETURNING id, camera_id, event_id, severity, resolved, created_at;
      `,
      [camera.id, event.id, severity],
    );

    await client.query('COMMIT');

    const alert = await getAlertById(alertQuery.rows[0].id);

    return {
      event,
      alert,
      vehicle,
      camera,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createSimulation,
  getAlertById,
  listAlerts,
  listCameras,
  listEvents,
  listVehicles,
  normalizeResolved,
  resolveAlert,
};