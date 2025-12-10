const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet'); // New security middleware
const { body, validationResult } = require('express-validator');

const app = express();

// --- SECURITY MIDDLEWARE ---
// Helmet sets Content-Security-Policy, X-Content-Type-Options, 
// Strict-Transport-Security, X-Frame-Options, etc.
app.use(helmet()); 

// Optional: Customize CSP if you need specific scripts allowed
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"], 
      scriptSrc: ["'self'"], 
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);

// --- STANDARD MIDDLEWARE ---
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURATION ---
const BASE_DIR = path.resolve(__dirname, 'files');

// Ensure base directory exists on startup
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

/**
 * Helper: Securely resolves a filename against the BASE_DIR.
 * Returns null if the path tries to traverse outside BASE_DIR.
 */
function resolveSecurePath(baseDir, filename) {
  try {
    // 1. Decode URI components (e.g. %20 -> space)
    const decoded = decodeURIComponent(filename);

    // 2. Resolve the absolute path
    const resolvedPath = path.resolve(baseDir, decoded);

    // 3. Security Check: Ensure the resolved path starts with the BASE_DIR
    // We append path.sep to ensure we match directory boundaries 
    // (prevents matching /files_secret against /files)
    if (!resolvedPath.startsWith(baseDir + path.sep)) {
      return null;
    }

    return resolvedPath;
  } catch (e) {
    return null; 
  }
}

// --- ROUTES ---

// Secure Read Route
app.post(
  '/read',
  body('filename')
    .exists().withMessage('Filename is required')
    .bail()
    .isString().withMessage('Filename must be a string')
    .trim()
    .notEmpty().withMessage('Filename cannot be empty')
    .custom(value => {
      // Prevent null byte poisoning
      if (value.includes('\0')) throw new Error('Null bytes are not allowed');
      return true;
    }),
  (req, res) => {
    // 1. Check Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const filename = req.body.filename;

    // 2. Secure Resolution
    const filePath = resolveSecurePath(BASE_DIR, filename);
    if (!filePath) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    // 3. Read File (Directly to avoid Race Conditions/TOCTOU)
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      res.json({ path: filePath, content });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      if (err.code === 'EISDIR') {
        return res.status(400).json({ error: 'Cannot read a directory' });
      }
      console.error('File read error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Helper route for samples (Securely implemented)
app.post('/setup-sample', (req, res) => {
  const samples = {
    'hello.txt': 'Hello from safe file!\n',
    'notes/readme.md': '# Readme\nSample readme file'
  };

  try {
    Object.keys(samples).forEach(k => {
      const p = resolveSecurePath(BASE_DIR, k);
      if (!p) return; // Skip invalid paths

      const d = path.dirname(p);
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(p, samples[k], 'utf8');
    });
    res.json({ ok: true, base: BASE_DIR });
  } catch (err) {
    res.status(500).json({ error: 'Failed to setup samples' });
  }
});

// --- STARTUP ---
if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

module.exports = app;
