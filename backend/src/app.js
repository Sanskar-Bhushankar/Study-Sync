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

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));

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
