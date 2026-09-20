import test from 'node:test';
import assert from 'node:assert/strict';
import KnowledgeSource from '../src/models/KnowledgeSource.js';
import KnowledgeItem from '../src/models/KnowledgeItem.js';
import KnowledgeRelationship from '../src/models/KnowledgeRelationship.js';
import {
  owned,
  approvedItems,
  reviewRecord,
  editItem,
  resolveReferences,
  createRelation,
} from '../src/services/knowledge/knowledgeService.js';
import { guardKnowledgeFields } from '../src/services/knowledge/integration.js';
const user = '111111111111111111111111',
  other = '222222222222222222222222',
  key = '333333333333333333333333';
const ref = { sourceId: key, sectionId: 'page-1' };
function stub(t, object, key, value) {
  const original = object[key];
  object[key] = value;
  t.after(() => {
    object[key] = original;
  });
}
test('private sources, items and relationships always query by session owner', async (t) => {
  for (const Model of [KnowledgeSource, KnowledgeItem, KnowledgeRelationship]) {
    stub(t, Model, 'findOne', async (query) => {
      assert.equal(query.userId, other);
      assert.equal(query._id, key);
      return null;
    });
    await assert.rejects(() => owned(Model, other, key), /not found/);
    assert.equal(Model.schema.path('userId').options.required, true);
  }
});
test('source references are copied from owned preserved sections, not client supplied text', async (t) => {
  stub(t, KnowledgeSource, 'findOne', async (query) => {
    assert.equal(query.userId, user);
    return {
      sections: [
        {
          id: 'page-1',
          page: 1,
          text: 'Exact original\nQualification',
          heading: 'Context',
        },
      ],
      location: 'Notes.pdf',
      sourceType: 'PERSONAL_NOTES',
    };
  });
  const result = await resolveReferences(user, [ref]);
  assert.equal(result[0].text, 'Exact original\nQualification');
  await assert.rejects(
    () => resolveReferences(user, [{ sourceId: key, sectionId: 'unknown' }]),
    /section not found/
  );
});
test('unapproved or foreign items cannot enter active methodology', async (t) => {
  stub(t, KnowledgeItem, 'find', (query) => {
    assert.equal(query.userId, user);
    assert.equal(query.status, 'approved');
    return { lean: async () => [] };
  });
  await assert.rejects(
    () => approvedItems(user, [key]),
    /belong to you and be approved/
  );
  assert.deepEqual(await approvedItems(user, []), []);
});
test('review requires explicit verification and complete interpretation; writes use revision CAS', async (t) => {
  const item = {
    revision: 1,
    status: 'needs_review',
    interpretation: 'Context-qualified meaning',
    kind: 'concept',
    references: [ref],
  };
  stub(t, KnowledgeItem, 'findOne', async () => item);
  stub(t, KnowledgeSource, 'findOne', async () => ({
    sections: [{ id: 'page-1', text: 'Original' }],
  }));
  let saved;
  stub(t, KnowledgeItem, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(filter.userId, user);
    assert.equal(filter.revision, 1);
    saved = update;
    return { ...item, ...update.$set, revision: 2 };
  });
  await assert.rejects(
    () =>
      reviewRecord(KnowledgeItem, user, key, {
        revision: 1,
        status: 'approved',
      }),
    /Explicit source verification/
  );
  await assert.rejects(
    () =>
      reviewRecord(KnowledgeItem, user, key, {
        revision: 2,
        status: 'approved',
        verification: true,
      }),
    /changed/
  );
  const result = await reviewRecord(KnowledgeItem, user, key, {
    revision: 1,
    status: 'approved',
    verification: true,
  });
  assert.equal(result.status, 'approved');
  assert.ok(saved.$set.verifiedAt);
  for (const status of ['rejected', 'superseded', 'needs_review']) {
    await reviewRecord(KnowledgeItem, user, key, { revision: 1, status });
    assert.equal(saved.$set.status, status);
    assert.equal(saved.$set.verifiedAt, null);
  }
  item.interpretation = '';
  await assert.rejects(
    () =>
      reviewRecord(KnowledgeItem, user, key, {
        revision: 1,
        status: 'approved',
        verification: true,
      }),
    /interpretation/
  );
});
test('editing approved knowledge preserves prior meaning and withdraws approval', async (t) => {
  stub(t, KnowledgeItem, 'findOne', async () => ({
    revision: 2,
    status: 'approved',
    interpretation: 'Old meaning',
  }));
  stub(t, KnowledgeSource, 'findOne', async () => ({
    sections: [{ id: 'page-1', text: 'Original' }],
  }));
  stub(t, KnowledgeItem, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(filter.revision, 2);
    assert.equal(update.$set.status, 'needs_review');
    assert.equal(update.$set.verifiedAt, null);
    assert.equal(update.$push.history.previous.interpretation, 'Old meaning');
    return update.$set;
  });
  const result = await editItem(user, key, {
    name: 'Updated',
    kind: 'concept',
    interpretation: 'New meaning',
    references: [ref],
    revision: 2,
  });
  assert.equal(result.interpretation, 'New meaning');
});
test('relationships cannot infer self links or bypass owned endpoints', async (t) => {
  await assert.rejects(
    () =>
      createRelation(user, {
        from: key,
        to: key,
        type: 'supports',
        evidence: 'Explicit statement',
        references: [ref],
      }),
    /different items/
  );
  stub(t, KnowledgeItem, 'findOne', async (filter) => {
    assert.equal(filter.userId, user);
    return null;
  });
  await assert.rejects(
    () =>
      createRelation(user, {
        from: key,
        to: other,
        type: 'supports',
        evidence: 'Explicit statement',
        references: [ref],
      }),
    /not found/
  );
});
test('legacy write endpoints cannot bypass methodology review', () => {
  for (const field of ['knowledgeIds', 'knowledgeDraftKey', 'methodology'])
    assert.throws(
      () => guardKnowledgeFields({ [field]: [] }),
      /review endpoint/
    );
  assert.doesNotThrow(() =>
    guardKnowledgeFields({ notes: 'Old features work' })
  );
});
