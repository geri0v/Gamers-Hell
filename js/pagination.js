/**
 * Simple pagination: returns first N items * page count
 * @param {Array} array - All filtered items
 * @param {Number} pageSize - Items per virtual "page"
 * @param {Number} pageNumber - Page count (1-based)
 * @returns {Array} Total slice of items up to page N
 */
export function paginate(array, pageSize, pageNumber) {
  return array.slice(0, pageSize * pageNumber);
}
