const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const matchRoutes = require('./routes/matchRoutes');
const featureRoutes = require('./routes/featureRoutes');

const app = express();

// Security headers (incl. CSP + no X-Powered-By). The built React app is a
// single JS/CSS bundle with no inline scripts, so default CSP is compatible.
app.use(helmet());
app.use(cookieParser());

// CORS: the browser app authenticates with cookies, so cross-origin calls
// (Vite dev on :5173 -> API on :4000) need credentials + an allowlisted
// origin. Same-origin production traffic is unaffected. In production, set
// FRONTEND_URL to the deployed web origin.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      // No Origin header (curl, smoke tests, server-to-server) -> allow.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS: origin not allowed'));
    },
    credentials: true,
  })
);
app.use(express.json());

// Brute-force guard lives on POST /api/auth/signup + /login (see
// authRoutes.js) so session-validated calls never burn the budget.
// Backstop limiter for the rest of the API: generous enough for chat
// polling + parallel QA (600/15min per IP), strict enough to blunt abuse.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down and try again.' },
});
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'kaushalchakra-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api', profileRoutes);
app.use('/api', matchRoutes);
app.use('/api', featureRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// In production the built React app is served by Express itself, so a single
// web service deploys the whole product (no separate static host needed).
const path = require('path');
const fs = require('fs');
const distPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback — client-side routes (/match/:id, /exchanges, ...) reload
  // cleanly; /api requests keep going to the API above.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log('Serving built frontend from frontend/dist');
}

// Central error handler — keeps error responses consistent
app.use((err, _req, res, _next) => {
  console.error(err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: 'Internal server error', ...(isDev && { detail: err.message }) });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`KaushalChakra backend listening on http://localhost:${PORT}`);
});
