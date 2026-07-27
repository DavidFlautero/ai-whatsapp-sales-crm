import { createApp } from "./server/createApp.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[api] running on http://localhost:${env.PORT}`);
});
