/** Files imported with Vite's `?raw` suffix are bundled as their text. */
declare module '*?raw' {
  const content: string;
  export default content;
}
