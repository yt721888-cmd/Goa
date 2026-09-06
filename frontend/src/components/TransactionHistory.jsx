import React, { useState, useEffect } from 'react';
import api from '../services/api';

function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, skip: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (filter !== 'all') {
        params.status = filter;
      }
      const response = await api.get('/transactions', { params });
      setTransactions(response.data.transactions);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'badge-pending',
      completed: 'badge-completed',
      failed: 'badge-failed',
      cancelled: 'badge-failed'
    };
    return `badge ${colors[status] || ''}`;
  };

  const getTypeIcon = (type) => {
    const icons = {
      deposit: '💰',
      withdrawal: '💸',
      bonus: '🎁',
      game_bet: '🎯',
      game_win: '🏆'
    };
    return icons[type] || '📊';
  };

  if (loading) {
    return <div className="loading">Loading transactions...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Transaction History</h1>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button 
            className={`btn ${filter === 'all' ? 'btn-primary' : ''}`}
            onClick={() => setFilter('all')}
            style={filter !== 'all' ? { background: '#f0f0f0', color: '#333' } : {}}
          >
            All
          </button>
          <button 
            className={`btn ${filter === 'pending' ? 'btn-primary' : ''}`}
            onClick={() => setFilter('pending')}
            style={filter !== 'pending' ? { background: '#f0f0f0', color: '#333' } : {}}
          >
            Pending
          </button>
          <button 
            className={`btn ${filter === 'completed' ? 'btn-primary' : ''}`}
            onClick={() => setFilter('completed')}
            style={filter !== 'completed' ? { background: '#f0f0f0', color: '#333' } : {}}
          >
            Completed
          </button>
          <button 
            className={`btn ${filter === 'failed' ? 'btn-primary' : ''}`}
            onClick={() => setFilter('failed')}
            style={filter !== 'failed' ? { background: '#f0f0f0', color: '#333' } : {}}
          >
            Failed
          </button>
        </div>

        {transactions.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', padding: '2rem 0' }}>
            No transactions found
          </p>
        ) : (
          <div>
            {transactions.map((transaction) => (
              <div key={transaction._id} className="transaction-item">
                <div className="transaction-info">
                  <span className="type">
                    {getTypeIcon(transaction.type)} {transaction.type.toUpperCase()}
                  </span>
                  <span className="date">
                    {new Date(transaction.createdAt).toLocaleString()}
                  </span>
                  {transaction.description && (
                    <span style={{ fontSize: '0.85rem', color: '#888' }}>
                      {transaction.description}
                    </span>
                  )}
                  {transaction.referenceId && (
                    <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                      Ref: {transaction.referenceId}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className={`transaction-amount ${transaction.type === 'deposit' || transaction.type === 'bonus' || transaction.type === 'game_win' ? 'positive' : 'negative'}`}>
                    {transaction.type === 'deposit' || transaction.type === 'bonus' || transaction.type === 'game_win' ? '+' : '-'}
                    ₹{transaction.amount.toFixed(2)}
                  </span>
                  <span className={getStatusBadge(transaction.status)}>
                    {transaction.status}
                  </span>
                </div>
              </div>
            ))}

            <div style={{ textAlign: 'center', marginTop: '1rem', color: '#888' }}>
              Showing {transactions.length} of {pagination.total} transactions
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionHistory;
