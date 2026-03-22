const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const projectRoutes = require('./routes/project.routes');
const inviteRoutes = require('./routes/invite.routes');
const topicRoutes = require('./routes/topic.routes');
const authenticate = require('./middleware/authenticate');
const isMember = require('./middleware/isMember');
const isOwner = require('./middleware/isOwner');
const topicController = require('./controllers/topic.controller');
const subtopicRoutes = require('./routes/subtopic.routes');
const progressRoutes = require('./routes/progress.routes');
const completionRoutes = require('./routes/completion.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const errorHandler = require('./middleware/errorHandler');

const ALLOWED_ORIGINS = [
  'https://study-sync-475p.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4000',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

const app = express();

// Gzip all JSON/text responses
app.use(compression());

// CORS before everything else
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Disable helmet policies that conflict with cross-origin responses
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false,
}));

// Generous limit for normal API usage (500 req/min)
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });

// Auth routes get a more relaxed separate limit (60 req/min — covers refresh on every page load)
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

app.use(express.json());

// Root status page
app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>StudySync API</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f13; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { background: #1a1a24; border: 1px solid #2d2d3d; border-radius: 16px; padding: 48px 56px; text-align: center; max-width: 480px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        .dot { width: 12px; height: 12px; border-radius: 50%; background: #22c55e; display: inline-block; margin-right: 8px; box-shadow: 0 0 8px #22c55e; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .status { display: flex; align-items: center; justify-content: center; font-size: 14px; color: #22c55e; font-weight: 600; margin-bottom: 32px; }
        h1 { font-size: 32px; font-weight: 800; color: #fff; margin-bottom: 8px; }
        .subtitle { color: #94a3b8; font-size: 15px; margin-bottom: 32px; }
        .badge { display: inline-block; background: rgba(170,59,255,0.15); color: #aa3bff; border: 1px solid rgba(170,59,255,0.3); border-radius: 99px; padding: 4px 14px; font-size: 12px; font-weight: 700; margin-bottom: 32px; }
        .endpoints { text-align: left; background: #0f0f13; border-radius: 10px; padding: 16px 20px; border: 1px solid #2d2d3d; }
        .endpoints p { font-size: 12px; color: #64748b; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .ep { font-size: 13px; color: #94a3b8; padding: 4px 0; font-family: 'Courier New', monospace; }
        .ep span { color: #aa3bff; margin-right: 8px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="status"><span class="dot"></span>API is running</div>
        <h1>📚 StudySync</h1>
        <p class="subtitle">Backend REST API</p>
        <div class="badge">v1</div>
        <div class="endpoints">
          <p>Available endpoints</p>
          <div class="ep"><span>POST</span>/api/v1/auth/register</div>
          <div class="ep"><span>POST</span>/api/v1/auth/login</div>
          <div class="ep"><span>POST</span>/api/v1/auth/refresh</div>
          <div class="ep"><span>GET</span>/api/v1/projects</div>
          <div class="ep"><span>GET</span>/api/v1/projects/:id/dashboard</div>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', apiLimiter, userRoutes);
// Explicit bulk route — must be before /api/v1/projects to avoid being shadowed
app.post('/api/v1/projects/:projectId/topics/bulk', apiLimiter, authenticate, isMember, isOwner, topicController.createBulk);
app.use('/api/v1', apiLimiter, inviteRoutes);
app.use('/api/v1', apiLimiter, topicRoutes);
app.use('/api/v1', apiLimiter, subtopicRoutes);
app.use('/api/v1', apiLimiter, progressRoutes);
app.use('/api/v1', apiLimiter, completionRoutes);
app.use('/api/v1', apiLimiter, dashboardRoutes);
app.use('/api/v1/projects', apiLimiter, projectRoutes);

app.use(errorHandler);
module.exports = app;
