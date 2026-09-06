import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import UPIPayment from './UPIPayment';
import api from '../services/api';

function Wallet() {
  const { user, updateUser } = useAuth();
  const [showUPI, setShowUPI] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const handlePaymentSuccess = (data) => {
    setShowUPI(false);
    setMessageType('success');
    setMessage(`Payment initiated! Reference: ${data.transaction.referenceId}`);
    
    // Refresh user balance
    api.get('/user/profile').then(res => {
      updateUser(res.data.user);
    });
  };

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Wallet</h1>

      <div className="balance-display">
        <div className="label">Available Balance</div>
        <div className="amount">₹{user?.balance?.toFixed(2) || '0.00'}</div>
      </div>

      {message && (
        <div className={`alert alert-${messageType}`}>
          {message}
          <button 
            onClick={() => setMessage('')}
            style={{ float: 'right', background: 'none', border: 'none', fontSize: '1.2rem' }}
          >
            ×
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header">Quick Actions</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowUPI(!showUPI)}
          >
            {showUPI ? 'Cancel' : '💰 Deposit via UPI'}
          </button>
          <button className="btn btn-success">💳 Withdraw</button>
          <button className="btn btn-danger">📊 Transaction History</button>
        </div>
      </div>

      {showUPI && (
        <div className="card">
          <UPIPayment onSuccess={handlePaymentSuccess} />
        </div>
      )}

      <div className="card">
        <div className="card-header">Payment Methods</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', border: '1px solid #e0e0e0', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem' }}>📱</div>
            <div>UPI</div>
          </div>
          <div style={{ padding: '1rem', border: '1px solid #e0e0e0', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem' }}>💳</div>
            <div>Cards</div>
          </div>
          <div style={{ padding: '1rem', border: '1px solid #e0e0e0', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem' }}>🏦</div>
            <div>Bank Transfer</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Wallet;
