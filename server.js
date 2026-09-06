const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ===================== DATABASE MODELS =====================

// User Model
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  balance: {
    type: Number,
    default: 0
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: Date,
  notificationPreferences: {
    email: { type: Boolean, default: true },
    telegram: { type: Boolean, default: false }
  }
});

// Transaction Model
const TransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'bonus', 'game_bet', 'game_win'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  description: String,
  referenceId: String,
  upiId: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', UserSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

// ===================== TELEGRAM NOTIFICATION SERVICE =====================

class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.isConfigured = this.botToken && this.chatId;
    this.baseUrl = this.isConfigured ? `https://api.telegram.org/bot${this.botToken}` : null;
    
    if (!this.isConfigured) {
      console.warn('⚠️ Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.');
    }
  }

  async sendMessage(message, parseMode = 'HTML') {
    if (!this.isConfigured) {
      console.log('📝 Telegram message (not sent - configure bot):', message);
      return null;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: true
      });
      return response.data;
    } catch (error) {
      console.error('Telegram notification failed:', error.response?.data || error.message);
      return null;
    }
  }

  async sendTransactionAlert(transaction, user) {
    const emoji = transaction.type === 'deposit' ? '💰' : '💸';
    const statusEmoji = {
      completed: '✅',
      pending: '⏳',
      failed: '❌',
      cancelled: '🚫'
    };
    
    const message = `
<b>${emoji} NEW TRANSACTION</b>
<b>User:</b> ${user.username} (${user.email})
<b>Type:</b> ${transaction.type.toUpperCase()}
<b>Amount:</b> ₹${transaction.amount.toFixed(2)}
<b>Status:</b> ${statusEmoji[transaction.status] || '⏳'} ${transaction.status.toUpperCase()}
<b>Reference:</b> ${transaction.referenceId || 'N/A'}
<b>UPI ID:</b> ${transaction.upiId || 'N/A'}
<b>Time:</b> ${new Date(transaction.createdAt).toLocaleString()}
    `;
    
    return this.sendMessage(message);
  }

  async sendUserAlert(user, action) {
    const message = `
<b>👤 USER ${action.toUpperCase()}</b>
<b>Username:</b> ${user.username}
<b>Email:</b> ${user.email}
<b>Registered:</b> ${new Date(user.createdAt).toLocaleString()}
<b>Balance:</b> ₹${user.balance.toFixed(2)}
    `;
    return this.sendMessage(message);
  }

  async sendSecurityAlert(user, ip, action) {
    const message = `
⚠️ <b>SECURITY ALERT</b>
<b>User:</b> ${user.username}
<b>Action:</b> ${action}
<b>IP Address:</b> ${ip || 'Unknown'}
<b>Time:</b> ${new Date().toLocaleString()}
    `;
    return this.sendMessage(message);
  }

  async sendUPIAlert(transaction, user, upiId) {
    const message = `
💳 <b>UPI PAYMENT REQUEST</b>
<b>User:</b> ${user.username} (${user.email})
<b>UPI ID:</b> <code>${upiId}</code>
<b>Amount:</b> ₹${transaction.amount.toFixed(2)}
<b>Reference:</b> ${transaction.referenceId}
<b>Status:</b> Pending ⏳
<b>Time:</b> ${new Date().toLocaleString()}
    `;
    return this.sendMessage(message);
  }
}

const telegram = new TelegramService();

// ===================== MIDDLEWARE =====================

// JWT Authentication Middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Admin Middleware
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Validation Middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({ errors: errors.array() });
  };
};

// ===================== AUTH ROUTES =====================

// Register
app.post('/api/auth/register',
  validate([
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ]),
  async (req, res) => {
    try {
      const { username, email, password } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(400).json({ 
          error: existingUser.email === email ? 'Email already registered' : 'Username already taken' 
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const user = new User({
        username,
        email,
        password: hashedPassword
      });

      await user.save();

      // Send Telegram notification
      await telegram.sendUserAlert(user, 'registered');

      // Generate token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          balance: user.balance
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Server error during registration' });
    }
  }
);

// Login
app.post('/api/auth/login',
  validate([
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
  ]),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Send login notification
      const clientIp = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'];
      await telegram.sendSecurityAlert(user, clientIp, 'login');

      // Generate token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          balance: user.balance,
          role: user.role
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error during login' });
    }
  }
);

// ===================== TRANSACTION ROUTES =====================

// Create UPI Transaction
app.post('/api/transactions/upi',
  authMiddleware,
  validate([
    body('amount').isFloat({ min: 10 }).withMessage('Minimum amount is ₹10'),
    body('upiId').notEmpty().withMessage('UPI ID is required')
  ]),
  async (req, res) => {
    try {
      const { amount, upiId, description } = req.body;

      // Create transaction
      const transaction = new Transaction({
        userId: req.user._id,
        type: 'deposit',
        amount,
        status: 'pending',
        description: description || `UPI Deposit via ${upiId}`,
        referenceId: `UPI_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        upiId: upiId
      });

      await transaction.save();

      // Send UPI notification to admin
      await telegram.sendUPIAlert(transaction, req.user, upiId);
      await telegram.sendTransactionAlert(transaction, req.user);

      res.status(201).json({
        message: 'Transaction initiated',
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          status: transaction.status,
          referenceId: transaction.referenceId,
          upiId: upiId
        }
      });

    } catch (error) {
      console.error('Transaction error:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  }
);

// Confirm Transaction (Admin only)
app.put('/api/transactions/:id/confirm',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { status } = req.body;
      const transaction = await Transaction.findById(req.params.id);

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.status !== 'pending') {
        return res.status(400).json({ error: 'Transaction already processed' });
      }

      transaction.status = status;
      await transaction.save();

      // Update user balance if completed
      if (status === 'completed') {
        const user = await User.findById(transaction.userId);
        user.balance += transaction.amount;
        await user.save();

        await telegram.sendMessage(`
✅ <b>TRANSACTION COMPLETED</b>
<b>User:</b> ${user.username}
<b>Amount:</b> ₹${transaction.amount.toFixed(2)}
<b>New Balance:</b> ₹${user.balance.toFixed(2)}
<b>UPI ID:</b> ${transaction.upiId || 'N/A'}
        `);
      }

      res.json({
        message: 'Transaction updated',
        transaction
      });

    } catch (error) {
      console.error('Transaction update error:', error);
      res.status(500).json({ error: 'Failed to update transaction' });
    }
  }
);

// Get User Transactions
app.get('/api/transactions',
  authMiddleware,
  async (req, res) => {
    try {
      const { limit = 50, skip = 0 } = req.query;
      
      const transactions = await Transaction.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Transaction.countDocuments({ userId: req.user._id });

      res.json({
        transactions,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      });

    } catch (error) {
      console.error('Fetch transactions error:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  }
);

// ===================== USER ROUTES =====================

// Get User Profile
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      balance: req.user.balance,
      role: req.user.role,
      isVerified: req.user.isVerified,
      createdAt: req.user.createdAt,
      lastLogin: req.user.lastLogin
    }
  });
});

// Update User Profile
app.put('/api/user/profile',
  authMiddleware,
  validate([
    body('username').optional().isLength({ min: 3 }),
    body('email').optional().isEmail()
  ]),
  async (req, res) => {
    try {
      const { username, email, notificationPreferences } = req.body;

      const updates = {};
      if (username) updates.username = username;
      if (email) updates.email = email;
      if (notificationPreferences) updates.notificationPreferences = notificationPreferences;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
      ).select('-password');

      // Send notification on profile update
      await telegram.sendMessage(`
👤 <b>PROFILE UPDATED</b>
<b>User:</b> ${user.username}
<b>Email:</b> ${user.email}
<b>Time:</b> ${new Date().toLocaleString()}
      `);

      res.json({
        message: 'Profile updated successfully',
        user
      });

    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// ===================== ADMIN ROUTES =====================

// Get all transactions (Admin only)
app.get('/api/admin/transactions',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { limit = 100, skip = 0, status } = req.query;
      
      const filter = {};
      if (status) filter.status = status;

      const transactions = await Transaction.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .populate('userId', 'username email');

      const total = await Transaction.countDocuments(filter);

      res.json({
        transactions,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      });

    } catch (error) {
      console.error('Admin fetch transactions error:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  }
);

// Get all users (Admin only)
app.get('/api/admin/users',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const users = await User.find().select('-password');
      res.json({ users });
    } catch (error) {
      console.error('Admin fetch users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// Test Telegram notification (Admin only)
app.post('/api/admin/test-notification',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      await telegram.sendMessage(`
🧪 <b>TEST NOTIFICATION</b>
This is a test message from your application.
<b>Time:</b> ${new Date().toLocaleString()}
<b>Server:</b> ${process.env.RENDER_SERVICE_ID || 'Local'}
      `);
      res.json({ message: 'Test notification sent successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  }
);

// ===================== HEALTH CHECK =====================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    telegram: telegram.isConfigured ? 'Configured ✅' : 'Not configured ⚠️'
  });
});

// ===================== START SERVER =====================

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  
  // Send startup notification
  telegram.sendMessage(`
🚀 <b>APPLICATION STARTED</b>
Server is now running on port ${process.env.PORT}
Time: ${new Date().toLocaleString()}
  `).catch(() => {});
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
