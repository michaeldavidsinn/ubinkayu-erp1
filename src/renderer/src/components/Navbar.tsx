// file: src/renderer/src/components/Navbar.tsx

import React, { useState } from 'react'
import logo from '../assets/WhatsApp Image 2025-09-09 at 14.30.02 - Edited.png'

interface NavbarProps {
  currentView: string
  onNavigate: (view: 'dashboard' | 'list' | 'tracking' | 'analysis') => void
}

const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLinkClick = (view: 'dashboard' | 'list' | 'tracking' | 'analysis') => {
    onNavigate(view)
    setMenuOpen(false) // Tutup menu setelah link di-klik
  }

  const getLinkClass = (viewName: string) => {
    if (viewName === 'Dashboard' && currentView === 'dashboard') return 'active'
    if (viewName === 'Purchase Orders' && ['list', 'input', 'detail'].includes(currentView))
      return 'active'
    if (viewName === 'Progress Tracking' && ['tracking', 'updateProgress'].includes(currentView))
      return 'active'
    if (viewName === 'Product Analysis' && currentView === 'analysis') return 'active'
    return ''
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img src={logo} alt="Ubinkayu Logo" className="navbar-logo" />
      </div>

      {/* Tombol Hamburger untuk Mobile */}
      <button className="hamburger-menu" onClick={() => setMenuOpen(!menuOpen)}>
        ☰
      </button>

      {/* Daftar Link Navigasi */}
      <div className={`navbar-links ${menuOpen ? 'active' : ''}`}>
        <a
          href="#"
          onClick={() => handleLinkClick('dashboard')}
          className={getLinkClass('Dashboard')}
        >
          Dashboard
        </a>
        <a
          href="#"
          onClick={() => handleLinkClick('list')}
          className={getLinkClass('Purchase Orders')}
        >
          Purchase Orders
        </a>
        <a
          href="#"
          onClick={() => handleLinkClick('tracking')}
          className={getLinkClass('Progress Tracking')}
        >
          Progress Tracking
        </a>
        <a
          href="#"
          onClick={() => handleLinkClick('analysis')}
          className={getLinkClass('Product Analysis')}
        >
          Product Analysis
        </a>
      </div>
    </nav>
  )
}

export default Navbar
