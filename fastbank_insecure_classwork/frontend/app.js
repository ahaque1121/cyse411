const API = "http://localhost:4000";

async function login(e) {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${API}/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const status = document.getElementById("login-status");

  if (!res.ok) {
    const data = await res.json();
    status.textContent = data.error;
    return;
  }

  status.textContent = "Logged in!";
  loadUser();
}

async function loadUser() {
  const res = await fetch(`${API}/me`, { credentials: "include" });
  if (!res.ok) return;

  const me = await res.json();

  document.getElementById("login-section").style.display = "none";

  document.getElementById("user-section").style.display = "";
  document.getElementById("transactions-section").style.display = "";
  document.getElementById("feedback-section").style.display = "";
  document.getElementById("email-section").style.display = "";

  document.getElementById("user-info").textContent = `${me.username} (${me.email})`;
}

async function searchTransactions(e) {
  e.preventDefault();
  const q = document.getElementById("search-q").value;

  const res = await fetch(`${API}/transactions?q=${encodeURIComponent(q)}`, {
    credentials: "include"
  });
  const tx = await res.json();

  const table = document.getElementById("transactions-table");

  while (table.firstChild) {
    table.removeChild(table.firstChild);
  }

  const headerRow = document.createElement("tr");
  ["ID", "Amount", "Description"].forEach(text => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  tx.forEach(t => {
    const row = document.createElement("tr");

    const idCell = document.createElement("td");
    idCell.textContent = t.id;

    const amountCell = document.createElement("td");
    amountCell.textContent = t.amount;

    const descCell = document.createElement("td");
    descCell.textContent = t.description;

    row.appendChild(idCell);
    row.appendChild(amountCell);
    row.appendChild(descCell);
    table.appendChild(row);
  });
}

async function submitFeedback(e) {
  e.preventDefault();
  const comment = document.getElementById("feedback-comment").value;

  await fetch(`${API}/feedback`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment })
  });

  loadFeedback();
}

async function loadFeedback() {
  const res = await fetch(`${API}/feedback`, { credentials: "include" });
  const list = await res.json();

  const container = document.getElementById("feedback-list");
  container.innerHTML = "";

  list.forEach(f => {
    const p = document.createElement("p");

    const strong = document.createElement("strong");
    strong.textContent = `${f.user}:`;
    p.appendChild(strong);

    const text = document.createTextNode(` ${f.comment}`);
    p.appendChild(text);

    container.appendChild(p);
  });
}

async function updateEmail(e) {
  e.preventDefault();
  const email = document.getElementById("new-email").value;

  await fetch(`${API}/change-email`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  loadUser();
}

document.getElementById("login-form").onsubmit = login;
document.getElementById("search-form").onsubmit = searchTransactions;
document.getElementById("feedback-form").onsubmit = submitFeedback;
document.getElementById("email-form").onsubmit = updateEmail;
