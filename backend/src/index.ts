import { createApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const app = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[openclone-backend] listening on :${port}`);
});
