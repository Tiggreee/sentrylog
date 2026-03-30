const express = require('express');
const asyncHandler = require('../lib/asyncHandler');
const { addClient, removeClient, broadcastAlert } = require('../lib/alertStream');
const {
  createSimulation,
  listAlerts,
  listCameras,
  listEvents,
  listVehicles,
  normalizeResolved,
  resolveAlert,
} = require('../services/monitoringService');

const router = express.Router();

router.get('/cameras', asyncHandler(async (_req, res) => {
  const cameras = await listCameras();
  res.json({ data: cameras });
}));

router.get('/alerts', asyncHandler(async (req, res) => {
  const alerts = await listAlerts({
    resolved: normalizeResolved(req.query.resolved),
    limit: req.query.limit,
  });

  res.json({ data: alerts });
}));

router.patch('/alerts/:id/resolve', asyncHandler(async (req, res) => {
  const alert = await resolveAlert(Number.parseInt(req.params.id, 10));
  res.json({ data: alert });
}));

router.get('/alerts/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  addClient(res);

  req.on('close', () => {
    removeClient(res);
  });
});

router.get('/vehicles', asyncHandler(async (req, res) => {
  const vehicles = await listVehicles({
    sort: req.query.sort,
    limit: req.query.limit,
  });

  res.json({ data: vehicles });
}));

router.get('/events', asyncHandler(async (req, res) => {
  const events = await listEvents({
    cameraId: req.query.camera_id,
    type: req.query.type,
    from: req.query.from,
    to: req.query.to,
    limit: req.query.limit,
  });

  res.json({ data: events });
}));

router.post('/simulate', asyncHandler(async (req, res) => {
  const result = await createSimulation(req.body);
  broadcastAlert(result.alert);
  res.status(201).json(result);
}));

module.exports = router;