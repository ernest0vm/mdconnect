/** Files imported with Vite's `?raw` suffix are bundled as their text. */
declare module '*?raw' {
  const content: string;
  export default content;
}

/** Files imported with Vite's `?worker&url` suffix are bundled as a worker script; this is its URL. */
declare module '*?worker&url' {
  const url: string;
  export default url;
}
