const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const matchRoutes = require('./routes/matchRoutes');
const featureRoutes = require('./routes/featureRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Brute-force guard: max 20 login/signup attempts per IP per 15 minutes.
// The rest of the API is JWT-protected, so a global limit isn't needed.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts — please wait 15 minutes and try again.' },
});
app.use('/api/auth', authLimiter);

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
