'use strict';

/**
 * Returns a sortOrder value that places a new record at the top of a scoped list
 * (lower sortOrder = higher in ascending sort).
 */
async function getNextTopSortOrder(Model, filter) {
  const minDoc = await Model.findOne(filter).sort({ sortOrder: 1 }).select('sortOrder').lean();
  if (!minDoc) return 0;
  return (minDoc.sortOrder ?? 0) - 1;
}

function reorderError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Assigns sortOrder 0..n-1 to documents in the order given by orderedIds.
 * All ids must exist within the provided filter scope.
 */
async function applyReorder(Model, filter, orderedIds, userId = null) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw reorderError('ids array is required');
  }

  const normalizedIds = orderedIds.map(String);
  const uniqueIds = new Set(normalizedIds);
  if (uniqueIds.size !== normalizedIds.length) {
    throw reorderError('ids must be unique');
  }

  const existing = await Model.find({ ...filter, _id: { $in: normalizedIds } }).select('_id').lean();
  if (existing.length !== normalizedIds.length) {
    throw reorderError('One or more items not found in this scope');
  }

  const updatedBy = userId ? { updatedBy: userId } : {};
  const ops = normalizedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id, ...filter },
      update: { $set: { sortOrder: index, ...updatedBy } },
    },
  }));

  await Model.bulkWrite(ops);
  return normalizedIds.length;
}

module.exports = { getNextTopSortOrder, applyReorder, reorderError };
