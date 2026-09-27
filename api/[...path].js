import { createApp } from '../server.js';

// One warm instance per serverless isolate. Sessions are signed, so a token
// from any instance is accepted. The JSON database lives in /tmp on Vercel.
const app = createApp({ background: false });

export default function handler(req, res) {
  return app.handler(req, res);
}
