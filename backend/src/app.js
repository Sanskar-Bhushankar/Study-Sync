const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const projectRoutes = require('./routes/project.routes');
const inviteRoutes = require('./routes/invite.routes');
const topicRoutes = require('./routes/topic.routes');
const subtopicRoutes = require('./routes/subtopic.routes');
const progressRoutes = require('./routes/progress.routes');
const completionRoutes = require('./routes/completion.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const errorHandler = require('./middleware/errorHandler');

const ALLOWED_ORIGINS = [
  'https://study-sync-475p.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Respond to all pre-flight OPTIONS requests immediately
app.options('*', cors());

// Generous limit for normal API usage (500 req/min)
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });

// Auth routes get a more relaxed separate limit (60 req/min — covers refresh on every page load)
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

app.use(express.json());

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', apiLimiter, userRoutes);
app.use('/api/v1/projects', apiLimiter, projectRoutes);
app.use('/api/v1', apiLimiter, inviteRoutes);
app.use('/api/v1', apiLimiter, topicRoutes);
app.use('/api/v1', apiLimiter, subtopicRoutes);
app.use('/api/v1', apiLimiter, progressRoutes);
app.use('/api/v1', apiLimiter, completionRoutes);
app.use('/api/v1', apiLimiter, dashboardRoutes);

app.use(errorHandler);
module.exports = app;
