import express from 'express';
import fs from 'fs';
import bodyParser from 'body-parser';
import { Server } from 'socket.io';
import http from 'http';
import cron from 'node-cron';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(bodyParser.json());

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
  const sorted = Object.entries(supporters).sort((a, b) => b[1]-a[1]);
  if (sorted.length === 0) return { name: '—', points: 0 };
  return { name: sorted[0][0], points: sorted[0][1] };
}

// API routes
app.get('/current', (req,res)=>{
  res.json(loadPoints());
});

app.post('/add-mock', (req,res)=>{
  const { username, points } = req.body;
  if(!username || !points) return res.status(400).json({error:"username and points required"});
  const data = loadPoints();
  data.currentPoints += points;
  if (data.currentPoints > 20000) data.currentPoints = 20000;
  savePoints(data);
  const top = updateSupporter(username, points);
  io.emit('updateGoal', data);
  io.emit('updateTopSupporter', top);
  res.json({message:'Points added', data, topSupporter: top});
});

app.post('/reset',(req,res)=>{
  savePoints({currentPoints:0});
  saveSupporters({});
  io.emit('updateGoal',{currentPoints:0});
  io.emit('updateTopSupporter',{name:'—',points:0});
  res.json({message:'Goal reset'});
});

// Monthly reset (1st day of every month at 00:00)
cron.schedule('0 0 1 * *', ()=>{
  savePoints({currentPoints:0});
  saveSupporters({});
  console.log('✅ Monthly reset done');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, ()=>console.log(`Backend running on port ${PORT}`));
