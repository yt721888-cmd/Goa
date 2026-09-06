import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Link } from 'react-router-dom';

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    recentTransactions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/transactions', { params: { limit: 5 } });
      const transactions = response.data.transactions;
      
      const totalDeposits = transactions
        .filter(t => t.type === 'deposit' && t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalWithdrawals = transactions
        .filter(t => t.type === 'withdrawal' && t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0);

      setStats({
        totalDeposits,
        totalWithdrawals,
        recentTransactions: transactions.slice(0, 5)
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Welcome back, {user?.username}! 👋</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">₹{user?.balance?.toFixed(2) || '0.00'}</div>
          <div className="stat-label">Current Balance</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">₹{stats.totalDeposits.toFixed(2)}</div>
          <div className="stat-label">Total Deposits</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">₹{stats.totalWithdrawals.toFixed(2)}</div>
          <div className="stat-label">Total Withdrawals</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.recentTransactions.length}</div>
          <div className="stat-label">Recent Transactions</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Recent Transactions</div>
        {stats.recentTransactions.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '2rem 0' }}>
            No transactions yet. <Link to="/wallet">Make a deposit</Link>
          </p>
        ) : (
          <div>
            {stats.recentTransactions.map((transaction) => (
              <div key={transaction._id} className="transaction-item">
                <div className="transaction-info">
                  <span className="type">{transaction.type.toUpperCase()}</span>
                  <span className="date">{new Date(transaction.createdAt).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className={`transaction-amount ${transaction.type === 'deposit' ? 'positive' : 'negative'}`}>
                    {transaction.type === 'deposit' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                  </span>
                  <span className={`badge badge-${transaction.status}`}>
                    {transaction.status}
                  </span>
                </div>
              </div>
            ))}
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Link to="/transactions" style={{ color: '#667eea' }}>View All →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
