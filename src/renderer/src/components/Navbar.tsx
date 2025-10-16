// file: src/renderer/src/components/Navbar.tsx

import React from 'react'
import logo from '../assets/WhatsApp Image 2025-09-09 at 14.30.02 - Edited.png'
// Impor ikon yang akan kita gunakan
import { LuLayoutDashboard, LuListOrdered, LuTrendingUp, LuActivity } from 'react-icons/lu'
// Impor file CSS yang akan kita buat
import './Navbar.css'

interface NavbarProps {
  currentView: string
  onNavigate: (view: 'dashboard' | 'list' | 'tracking' | 'analysis') => void
}

const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const handleLinkClick = (view: 'dashboard' | 'list' | 'tracking' | 'analysis') => {
    onNavigate(view)
  }

  // Fungsi ini sedikit disederhanakan untuk lebih mudah dibaca
  const getLinkClass = (viewName: 'dashboard' | 'list' | 'tracking' | 'analysis') => {
    const listViews = ['list', 'input', 'detail']
    const trackingViews = ['tracking', 'updateProgress']

    if (viewName === 'list' && listViews.includes(currentView)) return 'active'
    if (viewName === 'tracking' && trackingViews.includes(currentView)) return 'active'
    if (viewName === currentView) return 'active'

    return ''
  }

  return (
    <nav className="navbar">
      {/* Brand/logo hanya akan terlihat di desktop */}
      <div className="navbar-brand">
        <img src={logo} alt="Ubinkayu Logo" className="navbar-logo" />
      </div>

      {/* Daftar Link Navigasi */}
      <div className="navbar-links">
        <a
          href="#"
          onClick={() => handleLinkClick('dashboard')}
          className={`nav-link ${getLinkClass('dashboard')}`}
        >
          <LuLayoutDashboard className="nav-icon" />
          <span>Dashboard</span>
        </a>
        <a
          href="#"
          onClick={() => handleLinkClick('list')}
          className={`nav-link ${getLinkClass('list')}`}
        >
          <LuListOrdered className="nav-icon" />
          <span>Purchase Orders</span>
        </a>
        <a
          href="#"
          onClick={() => handleLinkClick('tracking')}
          className={`nav-link ${getLinkClass('tracking')}`}
        >
          <LuActivity className="nav-icon" />
          <span>Progress Tracking</span>
        </a>
        <a
          href="#"
          onClick={() => handleLinkClick('analysis')}
          className={`nav-link ${getLinkClass('analysis')}`}
        >
          <LuTrendingUp className="nav-icon" />
          <span>Product Analysis</span>
        </a>
      </div>
    </nav>
  )
}

export default Navbar
