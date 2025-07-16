/**
 * Simple pagination: returns first N items * page count
 * @param {Array} list - All filtered items
 * @param {Number} pageSize - Items per virtual "page"
 * @param {Number} pageNumber - Page count (1-based)
 * @returns {Array} Total slice of items up to page N
 */
export function paginate(list, pageSize, pageNumber) {
  return list.slice(0, pageSize * pageNumber);
}
// https://geri0v.github.io/Gamers-Hell/js/pagination.js

export function paginate(array, pageSize, pageNumber) {
  return array.slice(0, pageSize * pageNumber);
}
