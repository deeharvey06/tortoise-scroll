import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import adminRoutes from '../src/routes/adminRoutes.js';
import User from '../src/models/User.js';
import AuditLog from '../src/models/AuditLog.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const ids = { root: new mongoose.Types.ObjectId(), admin: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId() };
const originals = { findOne: User.findOne, findOneAndUpdate: User.findOneAndUpdate, auditCreate: AuditLog.create };
let calls;

before(() => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.get('x-test-role') || 'USER';
    req.user = { id: ids[role.toLowerCase()], role, email: `${role.toLowerCase()}@example.test`, displayName: role };
    next();
  });
  app.use('/api/admin', adminRoutes);
  app.use(errorHandler);
  globalThis.adminTestApp = app;
});

after(() => {
  User.findOne = originals.findOne;
  User.findOneAndUpdate = originals.findOneAndUpdate;
  AuditLog.create = originals.auditCreate;
  delete globalThis.adminTestApp;
});

function stubTarget(targetRole = 'USER', targetStatus = 'ACTIVE') {
  calls = { find: 0, update: 0, audit: 0 };
  const target = { _id: ids.user, email: 'user@example.test', displayName: 'User', role: targetRole, status: targetStatus };
  User.findOne = (filter) => {
    calls.find += 1;
    const value = filter.role?.$ne === 'ROOT' && targetRole === 'ROOT' ? null : { ...target };
    return { lean: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
  };
  User.findOneAndUpdate = async (_filter, update) => { calls.update += 1; return { ...target, ...update.$set }; };
  AuditLog.create = async () => { calls.audit += 1; };
}

test('USER has no administration access', async () => {
  stubTarget();
  const response = await request(globalThis.adminTestApp).get(`/api/admin/users/${ids.user}`).set('x-test-role', 'USER');
  assert.equal(response.status, 403); assert.equal(calls.find, 0);
});

test('ADMIN cannot change roles or statuses', async () => {
  stubTarget();
  const role = await request(globalThis.adminTestApp).patch(`/api/admin/users/${ids.user}/role`).set('x-test-role', 'ADMIN').send({ role: 'ADMIN' });
  const status = await request(globalThis.adminTestApp).patch(`/api/admin/users/${ids.user}/status`).set('x-test-role', 'ADMIN').send({ status: 'SUSPENDED' });
  assert.equal(role.status, 403); assert.equal(status.status, 403);
  assert.equal(calls.find, 0); assert.equal(calls.update, 0); assert.equal(calls.audit, 0);
});

test('ADMIN cannot view the audit log', async () => {
  const response = await request(globalThis.adminTestApp).get('/api/admin/audit-log').set('x-test-role', 'ADMIN');
  assert.equal(response.status, 403);
});

test('ADMIN may view a non-ROOT user without mutation controls', async () => {
  stubTarget('USER');
  const response = await request(globalThis.adminTestApp).get(`/api/admin/users/${ids.user}`).set('x-test-role', 'ADMIN');
  assert.equal(response.status, 200); assert.equal(response.body.user.role, 'USER');
  assert.equal(calls.update, 0); assert.equal(calls.audit, 0);
});

test('ADMIN cannot view, create, delete, or otherwise target ROOT', async () => {
  stubTarget('ROOT');
  const view = await request(globalThis.adminTestApp).get(`/api/admin/users/${ids.user}`).set('x-test-role', 'ADMIN');
  const create = await request(globalThis.adminTestApp).post('/api/admin/users').set('x-test-role', 'ADMIN').send({ role: 'ROOT' });
  const remove = await request(globalThis.adminTestApp).delete(`/api/admin/users/${ids.user}`).set('x-test-role', 'ADMIN');
  assert.equal(view.status, 404); assert.equal(create.status, 404); assert.equal(remove.status, 404);
  assert.equal(calls.update, 0); assert.equal(calls.audit, 0);
});

test('no caller can promote a user to ROOT', async () => {
  stubTarget();
  const response = await request(globalThis.adminTestApp).patch(`/api/admin/users/${ids.user}/role`).set('x-test-role', 'ROOT').send({ role: 'ROOT' });
  assert.equal(response.status, 400); assert.equal(calls.update, 0); assert.equal(calls.audit, 0);
});

test('ROOT cannot demote or suspend ROOT through administration APIs', async () => {
  stubTarget('ROOT');
  const role = await request(globalThis.adminTestApp).patch(`/api/admin/users/${ids.user}/role`).set('x-test-role', 'ROOT').send({ role: 'USER' });
  const status = await request(globalThis.adminTestApp).patch(`/api/admin/users/${ids.user}/status`).set('x-test-role', 'ROOT').send({ status: 'SUSPENDED' });
  assert.equal(role.status, 404); assert.equal(status.status, 404);
  assert.equal(calls.update, 0); assert.equal(calls.audit, 0);
});

test('ROOT can promote USER to ADMIN and writes an audit event', async () => {
  stubTarget('USER');
  const response = await request(globalThis.adminTestApp).patch(`/api/admin/users/${ids.user}/role`).set('x-test-role', 'ROOT').send({ role: 'ADMIN' });
  assert.equal(response.status, 200); assert.equal(response.body.user.role, 'ADMIN');
  assert.equal(calls.update, 1); assert.equal(calls.audit, 1);
});

test('ROOT can demote ADMIN to USER and writes an audit event', async () => {
  stubTarget('ADMIN');
  const response = await request(globalThis.adminTestApp).patch(`/api/admin/users/${ids.user}/role`).set('x-test-role', 'ROOT').send({ role: 'USER' });
  assert.equal(response.status, 200); assert.equal(response.body.user.role, 'USER');
  assert.equal(calls.update, 1); assert.equal(calls.audit, 1);
});

test('ROOT can suspend a non-ROOT user and writes an audit event', async () => {
  stubTarget('ADMIN', 'ACTIVE');
  const response = await request(globalThis.adminTestApp).patch(`/api/admin/users/${ids.user}/status`).set('x-test-role', 'ROOT').send({ status: 'SUSPENDED' });
  assert.equal(response.status, 200); assert.equal(response.body.user.status, 'SUSPENDED');
  assert.equal(calls.update, 1); assert.equal(calls.audit, 1);
});
