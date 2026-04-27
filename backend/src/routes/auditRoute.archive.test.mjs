// @vitest-environment node

import express from 'express';
import mongoose from 'mongoose';
import { createRequire } from 'module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const require = createRequire(import.meta.url);
const auditRouter = require('./auditRoute');
const { sessionManager } = require('../middleware/auth');

const buildTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/audit', auditRouter);
  return app;
};

const startServer = async (app) =>
  await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });

const stopServer = async (server) => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};

const postJson = async (server, path, token, body) => {
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  });

  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
};

describe('POST /api/audit/:id/archive input validation', () => {
  let app;
  let server;
  const createdTokens = [];

  beforeEach(async () => {
    app = buildTestApp();
    server = await startServer(app);
  });

  afterEach(async () => {
    await stopServer(server);

    for (const token of createdTokens) {
      await sessionManager.revokeSession(token);
    }

    createdTokens.length = 0;
  });

  it('returns 400 for invalid audit id format', async () => {
    const validUserId = new mongoose.Types.ObjectId().toString();
    const token = await sessionManager.createSession(validUserId, 'admin-user', 'admin');
    createdTokens.push(token);

    const result = await postJson(server, '/api/audit/not-a-valid-object-id/archive', token, {
      reason: 'Regression test',
    });

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      error: 'Invalid audit ID format',
      code: 'INVALID_AUDIT_ID',
    });
  });

  it('returns 401 for invalid session user id format', async () => {
    const token = await sessionManager.createSession('invalid-user-id', 'admin-user', 'admin');
    createdTokens.push(token);

    const validAuditId = new mongoose.Types.ObjectId().toString();
    const result = await postJson(server, `/api/audit/${validAuditId}/archive`, token, {
      reason: 'Regression test',
    });

    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({
      error: 'Invalid authentication session. Please sign in again.',
      code: 'INVALID_SESSION_USER',
    });
  });
});
