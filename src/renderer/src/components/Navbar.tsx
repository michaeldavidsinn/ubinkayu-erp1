/* eslint-disable prettier/prettier */
import React from 'react';

interface NavbarProps {
  currentView: string;
  // Tambahkan 'dashboard' ke tipe navigasi
  onNavigate: (view: 'dashboard' | 'list' | 'tracking') => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const getLinkClass = (viewName: string) => {
    // [FIX] Tambahkan kondisi untuk dashboard
    if (viewName === 'Dashboard' && currentView === 'dashboard') {
      return 'active';
    }
    if (viewName === 'Purchase Orders' && ['list', 'input', 'detail'].includes(currentView)) {
      return 'active';
    }
    if (viewName === 'Progress Tracking' && currentView === 'tracking') {
      return 'active';
    }
    return '';
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">PT Ubinkayu ERP</div>
      <div className="navbar-links">
        {/* [FIX] Jadikan link ini fungsional */}
        <a href="#" onClick={() => onNavigate('dashboard')} className={getLinkClass('Dashboard')}>
          Dashboard
        </a>
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
  );
};

export default Navbar;