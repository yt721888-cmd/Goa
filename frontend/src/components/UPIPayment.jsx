import React, { useState } from 'react';
import api from '../services/api';

function UPIPayment({ onSuccess }) {
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/transactions/upi', {
        amount: parseFloat(amount),
        upiId: upiId
      });

      // Show success message with instructions
      alert(
        `✅ Payment Initiated!\n\n` +
        `Please send ₹${amount} to:\n${upiId}\n\n` +
        `Reference ID: ${response.data.transaction.referenceId}\n\n` +
        `After payment, admin will verify and credit your account.`
      );

      setAmount('');
      setUpiId('');
      
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Payment initiation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 style={{ marginBottom: '1rem' }}>UPI Payment</h3>
      
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Amount (₹)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount (min ₹10)"
            min="10"
            step="1"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>UPI ID</label>
          <input
            type="text"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="e.g., example@upi"
            required
            disabled={loading}
          />
          <small style={{ color: '#888', display: 'block', marginTop: '0.25rem' }}>
            Enter the UPI ID where you'll send the payment
          </small>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Processing...' : 'Pay Now'}
        </button>
      </form>

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '10px' }}>
        <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
          💡 <strong>Instructions:</strong> After submitting, please send the exact amount 
          to the provided UPI ID. Your account will be credited after verification.
        </p>
      </div>
    </div>
  );
}

export default UPIPayment;
