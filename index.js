const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Import routes
const notificationsRouter = require('./routes/notifications');
const blogsRouter = require('./routes/blogs');
const logosRouter = require('./routes/logos');
const uploadRouter = require('./routes/upload');
const adminAuthRouter = require('./routes/adminAuth');
const { initScheduler } = require('./services/cronScheduler');


// Middleware
app.use(cors({ origin: true, credentials: true }));
// Mitigate CVE-2026-111181: reject unneeded compressed payloads before decompression stream is created
app.use(express.json({ inflate: false, limit: '10mb' }));
app.use(express.urlencoded({ extended: true, inflate: false, limit: '10mb' }));

// Serve generated blog cover images from data/blog-covers
app.use('/static/blog-covers', express.static(path.join(__dirname, 'data', 'blog-covers'), {
  maxAge: '30d',
  immutable: true
}));

// Routes
app.use('/api', notificationsRouter);
app.use('/api/notifications', notificationsRouter); 
app.use('/api/blogs', blogsRouter); 
app.use('/api/logos', logosRouter);
app.use('/api/upload', uploadRouter); 
app.use('/api/admin/auth', adminAuthRouter);

// Basic health check
app.get('/', (req, res) => {
  res.send('Techyarts Backend Server is Operating at Peak Capacity');
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // ── Initialize Daily Automated Blog Draft Scheduler (6:00 AM Weekdays) ──
  try {
    initScheduler(6, 0);
  } catch (err) {
    console.error('[Scheduler] Failed to initialize scheduler:', err.message);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: Port ${PORT} is already in use. Please close the other process or use a different port.`);
    process.exit(1);
  }
});

