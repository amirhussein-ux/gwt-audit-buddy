require('dotenv').config();

const express = require('express');
const cors = require('cors');
const auditRoute = require('./routes/auditRoute');

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'gwt-audit-backend',
  });
});

app.use('/api', auditRoute);

app.use((err, _req, res, _next) => {
  res.status(500).json({
    error: err?.message || 'Internal server error.',
  });
});

app.listen(PORT, () => {
  console.log(`GWT audit backend listening on port ${PORT}`);
});
