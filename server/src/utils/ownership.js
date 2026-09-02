export function ownerId(req) { return req.user.id; }
export function withoutOwnership(input = {}) { const { userId: _ignored, ownerId: _ownerIgnored, ...safe } = input; return safe; }
export function ownedPayload(req, input = {}) { return { ...withoutOwnership(input), userId: ownerId(req) }; }
export function ownedFilter(req, filter = {}) { return { ...filter, userId: ownerId(req) }; }
export async function requireOwnedReference(Model, id, userId, label = 'Resource') {
  if (id && !(await Model.exists({ _id: id, userId }))) { const error = new Error(`${label} not found`); error.statusCode = 404; throw error; }
}
export default { ownerId, withoutOwnership, ownedPayload, ownedFilter, requireOwnedReference };
