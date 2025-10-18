// file: src/renderer/src/components/Navbar.tsx

import React from 'react'
import logo from '../assets/WhatsApp Image 2025-09-09 at 14.30.02 - Edited.png'
import {
  LuLayoutDashboard,
  LuListOrdered,
  LuTrendingUp,
  LuActivity,
  LuRefreshCw, // <-- Impor ikon refresh
  LuLoader    // <-- Impor ikon loading
} from 'react-icons/lu'
import './Navbar.css'

// Perbarui interface untuk menerima props baru
interface NavbarProps {
  currentView: string
  onNavigate: (view: 'dashboard' | 'list' | 'tracking' | 'analysis') => void
  onRefresh: () => void
  isRefreshing: boolean
}

const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onRefresh, isRefreshing }) => {
  const handleLinkClick = (view: 'dashboard' | 'list' | 'tracking' | 'analysis') => {
    onNavigate(view)
  }

  const getLinkClass = (viewName: 'dashboard' | 'list' | 'tracking' | 'analysis') => {
    const listViews = ['list', 'input', 'detail', 'history']
    const trackingViews = ['tracking', 'updateProgress']

    if (viewName === 'list' && listViews.includes(currentView)) return 'active'
    if (viewName === 'tracking' && trackingViews.includes(currentView)) return 'active'
    if (viewName === currentView) return 'active'

    return ''
  }

  return (
    // Gunakan React Fragment agar bisa merender Navbar dan FAB secara bersamaan
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <img src={logo} alt="Ubinkayu Logo" className="navbar-logo" />
        </div>

        <div className="navbar-links">
          {/* ... link navigasi tetap sama ... */}
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

        {/* -- Tombol Refresh untuk Desktop -- */}
        <div className="navbar-actions">
          <button
            className="btn btn-secondary refresh-btn-desktop"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? <LuLoader className="spin-icon" /> : <LuRefreshCw />}
            <span>{isRefreshing ? 'Memuat...' : 'Refresh'}</span>
          </button>
        </div>
      </nav>

      {/* -- Floating Action Button (FAB) untuk Mobile -- */}
      <button
        className="refresh-fab-mobile"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label="Refresh Data"
      >
        {isRefreshing ? <LuLoader className="spin-icon" /> : <LuRefreshCw />}
      </button>
    </>
  )
}

export default Navbar