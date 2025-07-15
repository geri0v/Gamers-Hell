// https://geri0v.github.io/Gamers-Hell/js/pagination.js

export function paginate(array, pageSize, pageNumber) {
  return array.slice(0, pageSize * pageNumber);
}
