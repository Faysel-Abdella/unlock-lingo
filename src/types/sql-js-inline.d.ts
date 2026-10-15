// The inline build (wasm embedded as base64) has the same API as the main entry.
declare module 'sql.js/dist/sql-wasm-inline.js' {
  import initSqlJs from 'sql.js';
  export default initSqlJs;
}
