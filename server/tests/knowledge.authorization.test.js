import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import knowledgeRoutes from '../src/routes/knowledgeRoutes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

function appFor(role) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: '111111111111111111111111', role };
    next();
  });
  app.use('/api/knowledge', knowledgeRoutes);
  app.use(errorHandler);
  return app;
}

for (const role of ['USER', 'ADMIN']) {
  test(`${role} cannot read or mutate Methodology through direct APIs`, async () => {
    const app = appFor(role);
    for (const [method, path] of [
      ['get', '/metadata'],
      ['get', '/sources'],
      ['get', '/items'],
      ['get', '/sources/111111111111111111111111/original'],
      ['post', '/sources'],
      ['post', '/items'],
      ['put', '/items/111111111111111111111111'],
      ['post', '/relationships'],
      ['post', '/attach'],
      ['post', '/analytics'],
      ['get', '/trades/111111111111111111111111'],
    ]) {
      const response = await request(app)[method](`/api/knowledge${path}`);
      assert.equal(response.status, 403, `${method} ${path}`);
    }
  });
}

test('ROOT can access Methodology metadata', async () => {
  const response = await request(appFor('ROOT')).get('/api/knowledge/metadata');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.kinds));
});
