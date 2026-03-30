const clients = new Set();

function sendEvent(client, event, payload) {
  client.write(`event: ${event}\n`);
  client.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function addClient(res) {
  clients.add(res);
  res.write('retry: 10000\n');
  sendEvent(res, 'connected', { status: 'ok' });
}

function removeClient(res) {
  clients.delete(res);
}

function broadcastAlert(alert) {
  for (const client of clients) {
    sendEvent(client, 'alert', alert);
  }
}

module.exports = {
  addClient,
  removeClient,
  broadcastAlert,
};