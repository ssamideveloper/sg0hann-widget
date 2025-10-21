import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import './styles.css';

const socket = io(process.env.REACT_APP_BACKEND || 'http://localhost:3001');

function App() {
  const [points,setPoints]=useState(0);
  const [topSupporter,setTopSupporter]=useState({name:'—',points:0});
  const goal=20000;

  useEffect(()=>{
    fetch((process.env.REACT_APP_BACKEND || 'http://localhost:3001') + '/current')
      .then(r=>r.json()).then(d=>setPoints(d.currentPoints)).catch(()=>{});
    socket.on('updateGoal',(data)=>setPoints(data.currentPoints));
    socket.on('updateTopSupporter',(top)=>setTopSupporter(top));
    return ()=>{ socket.disconnect(); }
  },[]);

  return (
    <div className='overlay-container'>
      <div className='goal-container'>
        <div className='goal-bar' style={{width:`${Math.min(100, (points/goal*100))}%`}}></div>
        <div className='goal-text'>Goal: {points} / {goal}</div>
      </div>
      <AnimatePresence mode='wait'>
        <motion.div key={topSupporter.name} className='top-supporter'
          initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}}
          transition={{duration:0.6}}
        >
          💎 Top Supporter: <strong>{topSupporter.name}</strong> ({topSupporter.points} pts)
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default App;
