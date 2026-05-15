'use strict';

function parsePageQuery(req, { defaultLimit = 20, maxLimit = 200 } = {}) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function paginated(items, total, page, limit) {
  const pages = Math.max(1, Math.ceil(total / limit) || 1);
  return { items, total, page, pages, limit };
}

module.exports = { parsePageQuery, paginated };
