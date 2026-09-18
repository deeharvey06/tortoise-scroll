import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import instrumentSpecificationRoutes from '../src/routes/instrumentSpecificationRoutes.js';
import InstrumentSpecification from '../src/models/InstrumentSpecification.js';

const owner = new mongoose.Types.ObjectId();
const foreignOwner = new mongoose.Types.ObjectId();
const originals = new Map();
function stub(obj, key, value) {
  const token = `${obj.modelName || 'obj'}:${key}`;
  if (!originals.has(token)) originals.set(token, [obj, key, obj[key]]);
  obj[key] = value;
}
afterEach(() => {
  for (const [, [obj, key, value]] of originals) obj[key] = value;
  originals.clear();
});
function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    req.user = { id: owner };
    next();
  });
  instance.use('/instrument-specifications', instrumentSpecificationRoutes);
  instance.use((err, _req, res, _next) =>
    res
      .status(res.statusCode >= 400 ? res.statusCode : err.statusCode || 500)
      .json({ error: { message: err.message } })
  );
  return instance;
}

test('custom instrument creation ignores a client-supplied userId', async () => {
  let created;
  stub(InstrumentSpecification, 'exists', async () => null);
  stub(InstrumentSpecification, 'create', async (payload) => {
    created = payload;
    return { ...payload, _id: new mongoose.Types.ObjectId() };
  });
  const response = await request(app())
    .post('/instrument-specifications')
    .send({
      userId: foreignOwner,
      symbol: 'ES',
      assetType: 'future',
      tickSize: 0.25,
      tickValue: 12.5,
      pointValue: 50,
      contractMultiplier: 50,
      currency: 'USD',
      timezone: 'America/Chicago',
    });
  assert.equal(response.status, 201);
  assert.equal(String(created.userId), String(owner));
  assert.notEqual(String(created.userId), String(foreignOwner));
});

test('duplicate custom symbol/type configuration is rejected', async () => {
  stub(InstrumentSpecification, 'exists', async () => ({
    _id: new mongoose.Types.ObjectId(),
  }));
  const response = await request(app())
    .post('/instrument-specifications')
    .send({ symbol: 'ES', assetType: 'future', contractMultiplier: 50 });
  assert.equal(response.status, 409);
  assert.match(response.body.error.message, /already exists/i);
});

test('invalid instrument configuration is rejected before persistence', async () => {
  const response = await request(app())
    .post('/instrument-specifications')
    .send({
      symbol: 'BAD',
      assetType: 'future',
      contractMultiplier: 0,
      tickSize: -1,
    });
  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /contractMultiplier/i);
});

test('cross-user update cannot find a foreign specification because ownership is in the filter', async () => {
  let captured;
  stub(InstrumentSpecification, 'exists', async () => null);
  stub(InstrumentSpecification, 'findOneAndUpdate', async (filter) => {
    captured = filter;
    return null;
  });
  const response = await request(app())
    .put(`/instrument-specifications/${new mongoose.Types.ObjectId()}`)
    .send({ symbol: 'ES', assetType: 'future', contractMultiplier: 50 });
  assert.equal(response.status, 404);
  assert.equal(String(captured.userId), String(owner));
});

test('resolve returns system fallback and reports unknown future as not found', async () => {
  const originalFindOne = InstrumentSpecification.findOne;
  InstrumentSpecification.findOne = () => ({ lean: async () => null });
  try {
    let response = await request(app()).get(
      '/instrument-specifications/resolve?symbol=ESZ26&assetType=future'
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.contractMultiplier, 50);
    response = await request(app()).get(
      '/instrument-specifications/resolve?symbol=ZZZU26&assetType=future'
    );
    assert.equal(response.status, 404);
  } finally {
    InstrumentSpecification.findOne = originalFindOne;
  }
});

test('invalid currency, timezone, and positive numeric fields are rejected', async () => {
  let response = await request(app()).post('/instrument-specifications').send({
    symbol: 'ES',
    assetType: 'future',
    contractMultiplier: 50,
    currency: 'US',
  });
  assert.equal(response.status, 400);
  response = await request(app()).post('/instrument-specifications').send({
    symbol: 'ES',
    assetType: 'future',
    contractMultiplier: 50,
    timezone: 'Bad/Zone',
  });
  assert.equal(response.status, 400);
  response = await request(app()).post('/instrument-specifications').send({
    symbol: 'ES',
    assetType: 'future',
    contractMultiplier: 50,
    tickSize: -0.25,
  });
  assert.equal(response.status, 400);
});

test('duplicate update and missing delete remain owner-scoped', async () => {
  stub(InstrumentSpecification, 'exists', async () => ({
    _id: new mongoose.Types.ObjectId(),
  }));
  let response = await request(app())
    .put(`/instrument-specifications/${new mongoose.Types.ObjectId()}`)
    .send({ symbol: 'ES', assetType: 'future', contractMultiplier: 50 });
  assert.equal(response.status, 409);

  stub(InstrumentSpecification, 'findOneAndDelete', async (filter) => {
    assert.equal(String(filter.userId), String(owner));
    return null;
  });
  response = await request(app()).delete(
    `/instrument-specifications/${new mongoose.Types.ObjectId()}`
  );
  assert.equal(response.status, 404);
});

test('owned custom specification can be deleted', async () => {
  stub(InstrumentSpecification, 'findOneAndDelete', async (filter) => ({
    _id: filter._id,
    userId: owner,
  }));
  const response = await request(app()).delete(
    `/instrument-specifications/${new mongoose.Types.ObjectId()}`
  );
  assert.equal(response.status, 204);
});
