import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./admin-auth.js";
import { escapeHtml, getClientName, mountAdminPage } from "./admin-layout.js";

await mountAdminPage({ activePage: "support", title: "Support" });

let records = [];
let unsubscribeUsers;
const body = document.getElementById("supportTableBody");
const search = document.getElementById("supportSearch");
const statusFilter = document.getElementById("supportStatusFilter");

function statusOf(data) {
  return String(data.accountStatus || data.profileStatus || data.status || "pending").trim().toLowerCase();
}

function mobileDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function renderMetrics() {
  document.getElementById("supportTotal").textContent = records.length.toLocaleString("en-IN");
  document.getElementById("supportActive").textContent = records.filter((item) => statusOf(item.data) === "active").length.toLocaleString("en-IN");
  document.getElementById("supportPending").textContent = records.filter((item) => statusOf(item.data) === "pending").length.toLocaleString("en-IN");
  document.getElementById("supportContactable").textContent = records.filter((item) => item.data.mobile || item.data.email || item.data.personalEmail).length.toLocaleString("en-IN");
}

function renderTable() {
  const term = search.value.trim().toLowerCase();
  const filter = statusFilter.value;
  const visible = records.filter((item) => {
    const data = item.data;
    const haystack = `${getClientName(data)} ${data.email || ""} ${data.personalEmail || ""} ${data.mobile || ""} ${data.city || ""}`.toLowerCase();
    return (!term || haystack.includes(term)) && (!filter || statusOf(data) === filter);
  });

  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="6" class="table-empty">No matching clients found.</td></tr>';
    return;
  }

  body.innerHTML = visible.map((item) => {
    const data = item.data;
    const mobile = String(data.mobile || "").trim();
    const email = String(data.personalEmail || data.email || "").trim();
    const status = statusOf(data);
    const whatsapp = mobileDigits(mobile);
    return `<tr>
      <td><a class="table-primary-link" href="./client-profile.html?id=${encodeURIComponent(item.id)}">${escapeHtml(getClientName(data))}</a><small>${escapeHtml(item.id)}</small></td>
      <td>${escapeHtml(mobile || "—")}</td>
      <td>${email ? `<a class="table-primary-link" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : "—"}</td>
      <td>${escapeHtml(data.city || "—")}</td>
      <td><span class="status-badge ${escapeHtml(status.replace(/[^a-z]+/g, "-"))}">${escapeHtml(status)}</span></td>
      <td><div class="table-actions">${whatsapp ? `<a class="table-action" href="https://wa.me/${escapeHtml(whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}${email ? `<a class="table-action" href="mailto:${escapeHtml(email)}">Email</a>` : ""}<a class="table-action" href="./client-profile.html?id=${encodeURIComponent(item.id)}">Profile</a></div></td>
    </tr>`;
  }).join("");
}

search.addEventListener("input", renderTable);
statusFilter.addEventListener("change", renderTable);

unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
  records = snapshot.docs.map((item) => ({ id: item.id, data: item.data() }))
    .sort((a, b) => getClientName(a.data).localeCompare(getClientName(b.data)));
  renderMetrics();
  renderTable();
}, (error) => {
  console.error("Support directory listener failed:", error);
  body.innerHTML = '<tr><td colspan="6" class="table-empty">Client directory could not be loaded.</td></tr>';
});

window.addEventListener("beforeunload", () => unsubscribeUsers?.());
