const express      = require('express');
const session      = require('express-session');
const pgSession    = require('connect-pg-simple')(session);
const helmet       = require('helmet');
const cors         = require('cors');
const path         = require('path');
const { pool }     = require('./db');

const authRoutes      = require('./routes/auth');
const contractRoutes  = require('./routes/contracts');
const priorityRoutes  = require('./routes/priorities');
const auditRoutes     = require('./routes/audit');
const emailRoutes     = require('./routes/email');

const app  = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:"],
    },
  },
}));

// CORS — only allow same-origin in production
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost').split(',');
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session store backed by PostgreSQL
app.use(session({
  store: new pgSession({ pool, tableName: 'session' }),
  name:   'dco.sid',
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   8 * 60 * 60 * 1000, // 8-hour session
    sameSite: 'lax',
  },
}));

// API routes
app.use('/api/auth',        authRoutes);
app.use('/api/contracts',   contractRoutes);
app.use('/api/priorities',  priorityRoutes);
app.use('/api/audit-log',   auditRoutes);
app.use('/api/email-preview', emailRoutes);

// Health check (used by K8s liveness/readiness probes)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve static frontend from /app/public
app.use(express.static(path.join(__dirname, '../../public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`DCO CMS backend listening on port ${PORT}`);
});

module.exports = app;
