import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import './styles.css';

function App() {
  const [points, setPoints] = useState(0);
  const [topSupporter, setTopSupporter] = useState({ name: '—', points: 0 });
  const goal = 20000;

  // Determine backend URL
  const backendURL = process.env.REACT_APP_BACKEND || 'http://localhost:3001';

  useEffect(() => {
    // --- 1️⃣ Fetch initial points ---
    fetch(`${backendURL}/current`)
      .then(res => res.json())
      .then(data => setPoints(data.currentPoints))
      .catch(err => console.error('Fetch error:', err));

    // --- 2️⃣ Setup Socket.io connection ---
    const socket = io(backendURL);

    socket.on('updateGoal', data => setPoints(data.currentPoints));
    socket.on('updateTopSupporter', top => setTopSupporter(top));

    // --- 3️⃣ Optional polling fallback ---
    const interval = setInterval(() => {
      fetch(`${backendURL}/current`)
        .then(res => res.json())
        .then(data => setPoints(data.currentPoints))
        .catch(() => {});
    }, 5000); // every 5 seconds

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [backendURL]);

  return (
    <div className='overlay-container'>
      <div className='goal-container'>
        <div
          className='goal-bar'
          style={{ width: `${Math.min(100, (points / goal) * 100)}%` }}
        ></div>
        <div className='goal-text'>Goal: {points} / {goal}</div>
      </div>

      <AnimatePresence mode='wait'>
        <motion.div
          key={topSupporter.name}
          className='top-supporter'
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.6 }}
        >
          💎 Top Supporter: <strong>{topSupporter.name}</strong> ({topSupporter.points} pts)
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default App;
