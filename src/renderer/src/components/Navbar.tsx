/* eslint-disable prettier/prettier */
// src/renderer/src/components/Navbar.tsx

import React from 'react'

interface NavbarProps {
  activeLink: string
}

const Navbar: React.FC<NavbarProps> = ({ activeLink }) => (
  <nav className="navbar">
    <div className="navbar-brand">PT Ubinkayu ERP</div>
    <div className="navbar-links">
      <a href="#" className={activeLink === 'Dashboard' ? 'active' : ''}>
        Dashboard
      </a>
      <a href="#" className={activeLink === 'Purchase Orders' ? 'active' : ''}>
        Purchase Orders
      </a>
      <a href="#" className={activeLink === 'Progress Tracking' ? 'active' : ''}>
        Progress Tracking
      </a>
      <a href="#" className={activeLink === 'Reports' ? 'active' : ''}>
        Reports
      </a>
      <a href="#" className={activeLink === 'Users' ? 'active' : ''}>
        Users
      </a>
    </div>
  </nav>
)

export default Navbar