import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import './styles.css';

function App() {
  const [points, setPoints] = useState(0);
  const [topSupporter, setTopSupporter] = useState({ name: '—', points: 0 });
  const goal = 20000;

  const backendURL = process.env.REACT_APP_BACKEND || 'http://localhost:3001';

  // Compute gradient based on points
  function getBarGradient(points, goal) {
    const percent = Math.min(points / goal, 1);
    if (percent < 0.5) return 'linear-gradient(90deg, #7e22ce, #9333ea)';  // Purple
    if (percent < 0.8) return 'linear-gradient(90deg, #9333ea, #ec4899)';  // Pink
    return 'linear-gradient(90deg, #10b981, #3b82f6)';                     // Green
  }

  useEffect(() => {
    // Fetch initial points
    fetch(`${backendURL}/current`)
      .then(res => res.json())
      .then(data => setPoints(data.currentPoints))
      .catch(err => console.error('Fetch error:', err));

    const socket = io(backendURL);
    socket.on('updateGoal', data => setPoints(data.currentPoints));
    socket.on('updateTopSupporter', top => setTopSupporter(top));

    // Polling fallback
    const interval = setInterval(() => {
      fetch(`${backendURL}/current`)
        .then(res => res.json())
        .then(data => setPoints(data.currentPoints))
        .catch(() => {});
    }, 5000);

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
          style={{
            width: `${Math.min(100, (points / goal) * 100)}%`,
            background: getBarGradient(points, goal)
          }}
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
