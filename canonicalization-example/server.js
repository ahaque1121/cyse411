const express = require("express");
const path = require("path");
const fs = require("fs");
const { body, validationResult } = require("express-validator");

const app = express();

const BASE_DIR = path.resolve(__dirname, "files");

if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

app.use((req, res, next) => {
  res.removeHeader("x-powered-by");
  res.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  );
  res.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), fullscreen=(self)"
  );
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cross-Origin-Resource-Policy", "same-origin");
  res.set("Cross-Origin-Embedder-Policy", "require-corp");
  res.set("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function resolveSafe(baseDir, rawInput) {
  let value = rawInput;
  try {
    value = decodeURIComponent(rawInput);
  } catch (_) {}
  const resolved = path.resolve(baseDir, value);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}

app.post(
  "/read",
  [
    body("filename")
      .exists()
      .withMessage("filename required")
      .bail()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("filename must not be empty")
      .custom((value) => {
        if (value.includes("\0")) throw new Error("null byte not allowed");
        return true;
      }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const filename = req.body.filename;
    const normalized = resolveSafe(BASE_DIR, filename);

    if (!normalized) {
      return res.status(403).json({ error: "Path traversal detected" });
    }

    try {
      const content = fs.readFileSync(normalized, "utf8");
      res.json({ path: normalized, content });
    } catch (err) {
      if (err.code === "ENOENT") {
        return res.status(404).json({ error: "File not found" });
      }
      if (err.code === "EISDIR") {
        return res.status(400).json({ error: "Cannot read a directory" });
      }
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.post("/read-no-validate", (req, res) => {
  const filename = req.body.filename || "";
  const joined = path.join(BASE_DIR, filename);

  if (!fs.existsSync(joined)) {
    return res.status(404).json({ error: "File not found", path: joined });
  }

  try {
    const content = fs.readFileSync(joined, "utf8");
    res.json({ path: joined, content });
  } catch (_) {
    res.status(500).json({ error: "Read error" });
  }
});

app.post("/setup-sample", (req, res) => {
  const samples = {
    "hello.txt": "Hello from safe file!\n",
    "notes/readme.md": "# Readme\nSample readme file",
  };

  try {
    for (const [key, value] of Object.entries(samples)) {
      const p = resolveSafe(BASE_DIR, key);
      if (p) {
        const d = path.dirname(p);
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(p, value, "utf8");
      }
    }
    res.json({ ok: true, base: BASE_DIR });
  } catch (_) {
    res.status(500).json({ error: "Setup failed" });
  }
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

module.exports = app;
