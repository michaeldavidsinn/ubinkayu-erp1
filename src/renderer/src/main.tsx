// File: src/renderer/src/main.tsx

import React from 'react'
import ReactDOM from 'react-dom/client'
import './assets/main.css' // Pastikan ini mengarah ke file CSS utama Anda
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)