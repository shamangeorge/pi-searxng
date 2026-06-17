// Extension entry point. Pi names an extension after its entry file, but
// uses the parent directory name when the entry is index.*, so this root
// index.js makes the extension display as "pi-searxng" (the package dir).
export { default } from "./dist/pi-searxng.js";
