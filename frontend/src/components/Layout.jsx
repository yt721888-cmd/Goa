import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

function Layout() {
  return (
    <div className="app">
      <Navbar />
      <main className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
