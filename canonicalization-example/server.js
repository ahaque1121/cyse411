const express = require('express');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');

const app = express();

const BASE_DIR = path.resolve(__dirname, 'files');
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  );
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), fullscreen=(self)'
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function resolveSafe(baseDir, value) {
  let input = value;
  try {
    input = decodeURIComponent(value);
  } catch (_) {}
  const resolved = path.resolve(baseDir, input);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}

app.post(
  '/read',
  [
    body('filename')
      .exists()
      .withMessage('filename required')
      .bail()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('filename must not be empty')
      .custom((v) => {
        if (v.includes('\0')) {
          throw new Error('null byte not allowed');
        }
        return true;
      }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const filename = req.body.filename;
    const target = resolveSafe(BASE_DIR, filename);
    if (!target) {
      return res.status(403).json({ error: 'Path traversal detected' });
    }

    try {
      const content = fs.readFileSync(target, 'utf8');
      res.json({ path: target, content });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ er
