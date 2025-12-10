const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3001;

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.set(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  );
  res.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), fullscreen=(self)"
  );
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("X-Content-Type-Options", "nosniff");
  next();
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static("public"));

const SALT = 10;
const demoPassword = "password123";
const demoHash = bcrypt.hashSync(demoPassword, SALT);

const users = [
  {
    id: 1,
    username: "student",
    passwordHash: demoHash
  }
];

const sessions = {};

app.get("/api/me", (req, res) => {
  const token = req.cookies.session;
  if (!token || !sessions[token]) {
    return res.status(401).json({ authenticated: false });
  }

  const session = sessions[token];
  if (Date.now() > session.expiresAt) {
    delete sessions[token];
    res.clearCookie("session");
    return res.status(401).json({ authenticated: false });
  }

  const user = users.find((u) => u.id === session.userId);
  res.json({ authenticated: true, username: user.username });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  const genericError = { success: false, message: "Invalid username or password" };

  if (!user) {
    return res.status(401).json(genericError);
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json(genericError);
  }

  const token = crypto.randomUUID();

  sessions[token] = {
    userId: user.id,
    expiresAt: Date.now() + 3600000
  };

  res.cookie("session", token, {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
    maxAge: 3600000
  });

  res.json({ success: true, token });
});

app.post("/api/logout", (req, res) => {
  const token = req.cookies.session;
  if (token && sessions[token]) {
    delete sessions[token];
  }
  res.clearCookie("session");
  res.json({ success: true });
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

app.listen(PORT, () => {
  console.log(`FastBank Auth Lab running at http://localhost:${PORT}`);
});
