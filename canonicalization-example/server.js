const express = require("express");
const path = require("path");
const fs = require("fs");
const { body, validationResult } = require("express-validator");

const app = express();

const BASE_DIR = path.resolve(__dirname, "files");
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  );
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), fullscreen=(self)"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function resolveSafe(baseDir, userInput) {
  let value = userInput;
  try {
    value = decodeURIComponent(userInput);
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
        if (value.includes("\0")) {
          throw new Error("null byte not allowed");
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
      process.stderr.write(String(err) + "\n");
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.post("/read-no-validate", (req, res) => {
  const filename = req.body.filename || "";
  const targetPath = path.join(BASE_DIR, filename);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: "File not found", path: targetPath });
  }

  try {
    const content = fs.readFileSync(targetPath, "utf8");
    res.json({ path: targetPath, content });
  } catch (e) {
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
      if (!p) {
        continue;
      }
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(p, value, "utf8");
    }
    res.json({ ok: true, base: BASE_DIR });
  } catch (e) {
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
