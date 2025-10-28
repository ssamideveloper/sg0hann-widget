import express from 'express';
import fs from 'fs';
import bodyParser from 'body-parser';
import { Server } from 'socket.io';
import http from 'http';
import cron from 'node-cron';
import fetch from 'node-fetch'; // npm install node-fetch@2
import crypto from 'crypto';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(bodyParser.json());

// ---------------- POINTS LOGIC ----------------
const pointsFile = 'points.json';
const supportersFile = 'supporters.json';

function loadPoints() {
  if (!fs.existsSync(pointsFile)) return { currentPoints: 0 };
  return JSON.parse(fs.readFileSync(pointsFile));
}
function savePoints(data) {
  fs.writeFileSync(pointsFile, JSON.stringify(data, null, 2));
}
function loadSupporters() {
  if (!fs.existsSync(supportersFile)) return {};
  return JSON.parse(fs.readFileSync(supportersFile));
}
function saveSupporters(data) {
  fs.writeFileSync(supportersFile, JSON.stringify(data, null, 2));
}
function updateSupporter(username, points) {
  const supporters = loadSupporters();
  supporters[username] = (supporters[username] || 0) + points;
  saveSupporters(supporters);
  return getTopSupporter();
}
function getTopSupporter() {
  const supporters = loadSupporters();
  const sorted = Object.entries(supporters).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return { name: '—', points: 0 };
  return { name: sorted[0][0], points: sorted[0][1] };
}

// ---------------- API ROUTES ----------------
app.get('/current', (req, res) => {
  res.json(loadPoints());
});

app.post('/add-mock', (req, res) => {
  const { username, points } = req.body;
  if (!username || !points) return res.status(400).json({ error: "username and points required" });
  const data = loadPoints();
  data.currentPoints += points;
  if (data.currentPoints > 20000) data.currentPoints = 20000;
  savePoints(data);
  const top = updateSupporter(username, points);
  io.emit('updateGoal', data);
  io.emit('updateTopSupporter', top);
  res.json({ message: 'Points added', data, topSupporter: top });
});

app.post('/reset', (req, res) => {
  savePoints({ currentPoints: 0 });
  saveSupporters({});
  io.emit('updateGoal', { currentPoints: 0 });
  io.emit('updateTopSupporter', { name: '—', points: 0 });
  res.json({ message: 'Goal reset' });
});

// ---------------- Monthly Reset ----------------
cron.schedule('0 0 1 * *', () => {
  savePoints({ currentPoints: 0 });
  saveSupporters({});
  console.log('✅ Monthly reset done');
});

// ---------------- Twitch EventSub ----------------
const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const secret = process.env.TWITCH_SECRET;
const callbackURL = process.env.EVENTSUB_CALLBACK_URL;

let accessToken = '';

// Get Twitch App Access Token
async function getAccessToken() {
  const resp = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
    method: 'POST'
  });
  const data = await resp.json();
  accessToken = data.access_token;
  console.log('✅ Twitch access token obtained');
}

// Subscribe to EventSub
async function subscribeEventSub(type) {
  await getAccessToken();
  const body = {
    type,
    version: '1',
    condition: { broadcaster_user_id: broadcasterId },
    transport: {
      method: 'webhook',
      callback: callbackURL,
      secret
    }
  };
  const resp = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  console.log(`✅ EventSub ${type} subscription:`, data);
}

// Verify Twitch signature
function verifyTwitchSignature(req) {
  const messageId = req.headers['twitch-eventsub-message-id'];
  const timestamp = req.headers['twitch-eventsub-message-timestamp'];
  const signature = req.headers['twitch-eventsub-message-signature'];
  const hmac = crypto.createHmac('sha256', secret);
  const msg = messageId + timestamp + JSON.stringify(req.body);
  hmac.update(msg);
  const expected = 'sha256=' + hmac.digest('hex');
  return signature === expected;
}

// EventSub webhook route
app.post('/eventsub', (req, res) => {
  const msgType = req.headers['twitch-eventsub-message-type'];

  // Handle verification challenge
  if (msgType === 'webhook_callback_verification') {
    console.log('🔹 EventSub Challenge Received');
    return res.send(req.body.challenge);
  }

  // Verify signature
  if (!verifyTwitchSignature(req)) {
    return res.status(403).send('Invalid signature');
  }

  // Handle notifications
  if (msgType === 'notification') {
    const event = req.body.event;
    let username, points = 0;
    if (req.body.subscription.type === 'channel.cheer') {
      username = event.user_name;
      points = event.bits;
    } else if (req.body.subscription.type === 'channel.subscribe') {
      username = event.user_name;
      points = 500; // Arbitrary points for subs
    }

    const data = loadPoints();
    data.currentPoints += points;
    if (data.currentPoints > 20000) data.currentPoints = 20000;
    savePoints(data);

    const top = updateSupporter(username, points);

    io.emit('updateGoal', data);
    io.emit('updateTopSupporter', top);

    return res.status(200).send('OK');
  }

  res.status(200).end();
});

// ---------------- Start EventSub subscriptions ----------------
(async () => {
  try {
    await subscribeEventSub('channel.cheer');
    await subscribeEventSub('channel.subscribe');
  } catch (err) {
    console.error('❌ EventSub subscription failed:', err);
  }
})();

// ---------------- Start Server ----------------
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
