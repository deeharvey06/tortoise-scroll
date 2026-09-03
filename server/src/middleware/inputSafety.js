const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
const fail = (message) =>
  Object.assign(new Error(message), {
    statusCode: 400,
    publicMessage: message,
    isOperational: true,
  });

function inspect(value, depth = 0) {
  if (depth > 20) throw fail('Request input is nested too deeply');
  if (value == null || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || forbiddenKeys.has(key))
      throw fail('Request input contains a forbidden field name');
    inspect(value[key], depth + 1);
  }
}

export function inputSafety(req, _res, next) {
  try {
    inspect(req.body);
    inspect(req.query);
    inspect(req.params);
    next();
  } catch (error) {
    next(error);
  }
}

export default inputSafety;
