/* eslint-disable prettier/prettier */
// src/renderer/src/components/Navbar.tsx

import React from 'react'

interface NavbarProps {
  // BARU: Definisikan props yang diterima dari App.tsx
  currentView: string
  onNavigate: (view: 'list' | 'tracking') => void
}

const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  // Helper untuk menentukan apakah link aktif
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const getLinkClass = (viewName: string) => {
    if (viewName === 'Purchase Orders' && ['list', 'input', 'detail'].includes(currentView)) {
      return 'active'
    }
    if (viewName === 'Progress Tracking' && currentView === 'tracking') {
      return 'active'
    }
    return ''
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">PT Ubinkayu ERP</div>
      <div className="navbar-links">
        <a href="#" className={getLinkClass('Dashboard')}>
          Dashboard
        </a>
        {/* BARU: Gunakan onNavigate untuk mengubah view */}
        <a href="#" onClick={() => onNavigate('list')} className={getLinkClass('Purchase Orders')}>
          Purchase Orders
        </a>
        <a href="#" onClick={() => onNavigate('tracking')} className={getLinkClass('Progress Tracking')}>
          Progress Tracking
        </a>
        <a href="#" className={getLinkClass('Reports')}>
          Reports
        </a>
        <a href="#" className={getLinkClass('Users')}>
          Users
        </a>
      </div>
    </nav>
  )
}

export default Navbar