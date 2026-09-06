import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="nav-brand">💰 Secure App</Link>
        
        <ul className="nav-links">
          <li><Link to="/dashboard">Dashboard</Link></li>
          <li><Link to="/wallet">Wallet</Link></li>
          <li><Link to="/transactions">Transactions</Link></li>
          {user?.role === 'admin' && (
            <li><Link to="/admin">Admin</Link></li>
          )}
          <li>
            <span style={{ opacity: 0.8 }}>
              👤 {user?.username} (₹{user?.balance?.toFixed(2)})
            </span>
          </li>
          <li>
            <button onClick={logout} className="btn-logout">
              Logout
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
