import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db, logoutAdmin, observeAuth, verifyAdmin } from "./admin-auth.js";

const clientId = new URLSearchParams(window.location.search).get("id");

const gate = document.getElementById("authGate");
const shell = document.getElementById("adminShell");
const profileLoading = document.getElementById("profileLoading");
const profileError = document.getElementById("profileError");
const profileErrorText = document.getElementById("profileErrorText");
const profileContent = document.getElementById("profileContent");

let currentAdmin = null;
let clientData = null;
let unsubscribeClient = null;
let unsubscribeNotes = null;
let unsubscribeActivity = null;
let unsubscribeServices = null;
let serviceRecords = new Map();

function text(value) {
  return String(value ?? "").trim();
}

function normalizeMobile(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function firstValue(data, keys, fallback = "") {
  for (const key of keys) {
    if (data?.[key] !== undefined && data?.[key] !== null && String(data[key]).trim() !== "") return data[key];
  }
  return fallback;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

function initials(name, email) {
  const source = text(name || email || "Client");
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value, includeTime = false) {
  const date = dateValue(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

function sourceLabel(source) {
  if (source === "excel_import") return "Excel import";
  if (source === "manual_admin") return "Manual entry";
  return "App registration";
}

function statusClass(status) {
  return ["pending", "active", "inactive", "suspended", "rejected"].includes(status) ? status : "pending";
}

function setMessage(element, message, type = "info") {
  element.textContent = message;
  element.className = `modal-status ${type}`;
  element.hidden = !message;
}

function showError(message) {
  profileLoading.hidden = true;
  profileContent.hidden = true;
  profileError.hidden = false;
  profileErrorText.textContent = message;
}

function detailCards(fields) {
  return fields.map(([label, value]) => `
    <article><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || "—")}</strong></article>
  `).join("");
}

function currentFullName(data) {
  const firstName = text(firstValue(data, ["firstName", "first_name"]));
  const lastName = text(firstValue(data, ["lastName", "last_name"]));
  return text(firstValue(data, ["fullName", "name", "displayName"], `${firstName} ${lastName}`)) || "Unnamed client";
}

function renderProfile(data) {
  clientData = data;
  const name = currentFullName(data);
  const email = text(firstValue(data, ["email", "emailAddress"]));
  const mobile = normalizeMobile(firstValue(data, ["mobile", "phone", "phoneNumber", "contactNumber"]));
  const status = text(firstValue(data, ["accountStatus", "profileStatus", "status"], "pending")).toLowerCase();
  const source = text(firstValue(data, ["source"], "app_registration"));
  const createdAt = firstValue(data, ["createdAt", "registeredAt", "registrationDate", "importedAt"]);

  document.title = `${name} | TWS Connect Admin`;
  document.getElementById("profileRecordId").textContent = `Record: ${clientId}`;
  document.getElementById("profileAvatar").textContent = initials(name, email);
  document.getElementById("profileName").textContent = name;
  document.getElementById("profileContact").textContent = [mobile ? `+91 ${mobile}` : "", email].filter(Boolean).join(" · ") || "No contact information";
  document.getElementById("profileSource").textContent = sourceLabel(source);
  document.getElementById("profileCreated").textContent = `Registered ${formatDate(createdAt)}`;
  document.getElementById("profileAuth").textContent = data.authStatus === "active" ? "App login active" : "No app login";

  const badge = document.getElementById("profileStatusBadge");
  badge.textContent = status;
  badge.className = `status-badge ${statusClass(status)}`;

  document.getElementById("accountStatusSelect").value = statusClass(status);
  document.getElementById("identityVerified").checked = data.identityVerified === true;
  document.getElementById("contactVerified").checked = data.contactVerified === true;
  document.getElementById("riskProfileReviewed").checked = data.riskProfileReviewed === true;
  document.getElementById("documentsRequested").checked = data.documentsRequested === true;

  document.getElementById("personalDetailsGrid").innerHTML = detailCards([
    ["First Name", firstValue(data, ["firstName"], "—")],
    ["Last Name", firstValue(data, ["lastName"], "—")],
    ["Email", email || "—"],
    ["Mobile", mobile ? `+91 ${mobile}` : "—"],
    ["Date of Birth", firstValue(data, ["dob", "dateOfBirth"], "—")],
    ["Address", firstValue(data, ["address", "residentialAddress"], "—")],
    ["City", firstValue(data, ["city"], "—")],
    ["Pincode", firstValue(data, ["pincode", "pin"], "—")]
  ]);

  const preferences = [
    data.equityCash ? "Equity Cash" : "",
    data.equityFuture ? "Equity Future" : "",
    data.equityOptions ? "Equity Options" : "",
    data.indexFuture ? "Index Futures" : "",
    data.indexOptions ? "Index Options" : "",
    data.mcx ? "MCX" : ""
  ].filter(Boolean).join(", ") || firstValue(data, ["tradingPreferences"], "—");

  document.getElementById("investmentDetailsGrid").innerHTML = detailCards([
    ["Annual Income", firstValue(data, ["annualIncome"], "—")],
    ["Risk Tolerance", firstValue(data, ["riskTolerance"], "—")],
    ["Preferred Broker", firstValue(data, ["broker"], "—")],
    ["Trading Preferences", preferences],
    ["Investment Amount", firstValue(data, ["investmentAmount"], "—")],
    ["FO Enabled", firstValue(data, ["foEnabled"], "—")]
  ]);

  document.getElementById("tradingDetailsGrid").innerHTML = detailCards([
    ["Trading Broker", firstValue(data, ["tradingBroker", "broker"], "—")],
    ["Login ID", firstValue(data, ["loginId"], "—")],
    ["Account Source", sourceLabel(source)],
    ["Authentication", data.authStatus === "active" ? "Active Firebase login" : "Not created"],
    ["Last Updated", formatDate(firstValue(data, ["updatedAt", "statusUpdatedAt", "createdAt"]), true)],
    ["Client UID / ID", clientId]
  ]);

  profileLoading.hidden = true;
  profileError.hidden = true;
  profileContent.hidden = false;

  updateActionButtons(status);
}

function updateActionButtons(status) {
  document.getElementById("approveClientButton").hidden = status === "active";
  document.getElementById("rejectClientButton").hidden = status === "rejected";
  document.getElementById("suspendClientButton").textContent = status === "suspended" ? "Reactivate" : "Suspend";
}

async function logActivity(action, details = "", metadata = {}) {
  await addDoc(collection(db, "users", clientId, "activity_logs"), {
    action,
    details,
    metadata,
    createdAt: serverTimestamp(),
    adminUid: currentAdmin?.uid || "",
    adminEmail: currentAdmin?.email || "",
    adminName: currentAdmin?.name || ""
  });
}

async function updateStatus(nextStatus, reason = "") {
  const previousStatus = text(firstValue(clientData, ["accountStatus", "profileStatus", "status"], "pending")).toLowerCase();
  await updateDoc(doc(db, "users", clientId), {
    accountStatus: nextStatus,
    statusReason: text(reason),
    statusUpdatedAt: serverTimestamp(),
    statusUpdatedBy: currentAdmin?.email || "",
    approvedAt: nextStatus === "active" ? serverTimestamp() : firstValue(clientData, ["approvedAt"], null),
    approvedBy: nextStatus === "active" ? currentAdmin?.email || "" : firstValue(clientData, ["approvedBy"], "")
  });
  await logActivity("account_status_changed", `Status changed from ${previousStatus} to ${nextStatus}.`, {
    previousStatus, nextStatus, reason: text(reason)
  });
}

function fillEditForm() {
  const form = document.getElementById("editProfileForm");
  const values = {
    firstName: firstValue(clientData, ["firstName"]),
    lastName: firstValue(clientData, ["lastName"]),
    email: firstValue(clientData, ["email", "emailAddress"]),
    mobile: normalizeMobile(firstValue(clientData, ["mobile", "phone", "phoneNumber"])),
    dob: firstValue(clientData, ["dob", "dateOfBirth"]),
    city: firstValue(clientData, ["city"]),
    pincode: firstValue(clientData, ["pincode", "pin"]),
    annualIncome: firstValue(clientData, ["annualIncome"]),
    riskTolerance: firstValue(clientData, ["riskTolerance"]),
    broker: firstValue(clientData, ["broker"]),
    tradingBroker: firstValue(clientData, ["tradingBroker"]),
    investmentAmount: firstValue(clientData, ["investmentAmount"]),
    address: firstValue(clientData, ["address", "residentialAddress"])
  };
  Object.entries(values).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
}

function renderTimeline(container, items, emptyText) {
  if (!items.length) {
    container.innerHTML = `<div class="timeline-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }
  container.innerHTML = items.map((item) => `
    <article class="timeline-item">
      <span></span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.body || "")}</p>
        <small>${escapeHtml(formatDate(item.createdAt, true))} · ${escapeHtml(item.adminName || item.adminEmail || "TWS Admin")}</small>
      </div>
    </article>
  `).join("");
}

function subscribeNotes() {
  const notesQuery = query(collection(db, "users", clientId, "admin_notes"), orderBy("createdAt", "desc"));
  unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
    const notes = snapshot.docs.map((item) => {
      const data = item.data();
      return { title: "Internal note", body: data.note, createdAt: data.createdAt, adminName: data.adminName, adminEmail: data.adminEmail };
    });
    renderTimeline(document.getElementById("notesTimeline"), notes, "No internal notes yet.");
  }, (error) => {
    console.warn("Notes listener failed:", error);
    document.getElementById("notesTimeline").innerHTML = `<div class="timeline-empty">Notes could not be loaded.</div>`;
  });
}

function subscribeActivity() {
  const activityQuery = query(collection(db, "users", clientId, "activity_logs"), orderBy("createdAt", "desc"));
  unsubscribeActivity = onSnapshot(activityQuery, (snapshot) => {
    const items = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        title: String(data.action || "activity").replaceAll("_", " "),
        body: data.details || "",
        createdAt: data.createdAt,
        adminName: data.adminName,
        adminEmail: data.adminEmail
      };
    });
    renderTimeline(document.getElementById("activityTimeline"), items, "No activity recorded yet.");
  }, (error) => {
    console.warn("Activity listener failed:", error);
    document.getElementById("activityTimeline").innerHTML = `<div class="timeline-empty">Activity could not be loaded.</div>`;
  });
}

function subscribeClient() {
  if (!clientId) {
    showError("No client record ID was provided.");
    return;
  }

  unsubscribeClient = onSnapshot(doc(db, "users", clientId), (snapshot) => {
    if (!snapshot.exists()) {
      showError("This client record does not exist.");
      return;
    }
    renderProfile(snapshot.data());
  }, (error) => {
    console.error("Client listener failed:", error);
    showError(`${error.code || "Firebase error"}: ${error.message || "Unable to read client record."}`);
  });

  subscribeNotes();
  subscribeActivity();
  subscribeServices();
}

observeAuth(async (user) => {
  if (!user) {
    window.location.replace("./");
    return;
  }
  try {
    const result = await verifyAdmin(user);
    if (!result.allowed) {
      await logoutAdmin();
      return;
    }

    const displayName = result.profile?.name || user.displayName || "TWS Admin";
    currentAdmin = { uid: user.uid, email: user.email || "", name: displayName };
    document.getElementById("adminName").textContent = displayName;
    document.getElementById("adminEmail").textContent = user.email || "";
    document.getElementById("adminAvatar").textContent = initials(displayName, user.email);
    gate.hidden = true;
    shell.hidden = false;
    subscribeClient();
  } catch (error) {
    console.error("Admin verification failed:", error);
    gate.querySelector("p").textContent = "Unable to verify admin access.";
  }
});

document.getElementById("logoutButton").addEventListener("click", logoutAdmin);
document.getElementById("sidebarToggle").addEventListener("click", () => document.getElementById("adminSidebar").classList.toggle("open"));

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".profile-tab-panel").forEach((panel) => panel.classList.remove("active"));
    document.getElementById(`tab-${button.dataset.tab}`).classList.add("active");
  });
});

document.getElementById("approveClientButton").addEventListener("click", async () => {
  try {
    await updateStatus("active", "Approved from client profile.");
  } catch (error) {
    alert(error.message || "Client could not be approved.");
  }
});

document.getElementById("rejectClientButton").addEventListener("click", async () => {
  const reason = prompt("Enter rejection reason (optional):") ?? "";
  try {
    await updateStatus("rejected", reason);
  } catch (error) {
    alert(error.message || "Client could not be rejected.");
  }
});

document.getElementById("suspendClientButton").addEventListener("click", async () => {
  const current = text(firstValue(clientData, ["accountStatus", "status"], "pending")).toLowerCase();
  const next = current === "suspended" ? "active" : "suspended";
  const reason = next === "suspended" ? (prompt("Enter suspension reason (optional):") ?? "") : "Reactivated from client profile.";
  try {
    await updateStatus(next, reason);
  } catch (error) {
    alert(error.message || "Client status could not be updated.");
  }
});

document.getElementById("saveAccountStatusButton").addEventListener("click", async () => {
  const button = document.getElementById("saveAccountStatusButton");
  button.disabled = true;
  setMessage(document.getElementById("accountStatusMessage"), "Saving account status…", "info");
  try {
    await updateStatus(document.getElementById("accountStatusSelect").value, document.getElementById("statusReasonInput").value);
    setMessage(document.getElementById("accountStatusMessage"), "Account status updated.", "success");
    document.getElementById("statusReasonInput").value = "";
  } catch (error) {
    setMessage(document.getElementById("accountStatusMessage"), error.message || "Status could not be updated.", "error");
  } finally {
    button.disabled = false;
  }
});

document.getElementById("saveChecklistButton").addEventListener("click", async () => {
  const button = document.getElementById("saveChecklistButton");
  const message = document.getElementById("checklistMessage");
  button.disabled = true;
  setMessage(message, "Saving checklist…", "info");
  try {
    const checklist = {
      identityVerified: document.getElementById("identityVerified").checked,
      contactVerified: document.getElementById("contactVerified").checked,
      riskProfileReviewed: document.getElementById("riskProfileReviewed").checked,
      documentsRequested: document.getElementById("documentsRequested").checked,
      reviewChecklistUpdatedAt: serverTimestamp(),
      reviewChecklistUpdatedBy: currentAdmin?.email || ""
    };
    await updateDoc(doc(db, "users", clientId), checklist);
    await logActivity("review_checklist_updated", "Client review checklist was updated.", checklist);
    setMessage(message, "Checklist saved successfully.", "success");
  } catch (error) {
    setMessage(message, error.message || "Checklist could not be saved.", "error");
  } finally {
    button.disabled = false;
  }
});

document.getElementById("addNoteButton").addEventListener("click", async () => {
  const input = document.getElementById("newNoteInput");
  const message = document.getElementById("noteStatusMessage");
  const note = text(input.value);
  if (!note) {
    setMessage(message, "Enter a note before saving.", "error");
    return;
  }
  try {
    document.getElementById("addNoteButton").disabled = true;
    setMessage(message, "Saving private note…", "info");
    await addDoc(collection(db, "users", clientId, "admin_notes"), {
      note,
      createdAt: serverTimestamp(),
      adminUid: currentAdmin?.uid || "",
      adminEmail: currentAdmin?.email || "",
      adminName: currentAdmin?.name || ""
    });
    await logActivity("internal_note_added", "A private admin note was added.");
    input.value = "";
    setMessage(message, "Internal note saved.", "success");
  } catch (error) {
    setMessage(message, error.message || "Note could not be saved.", "error");
  } finally {
    document.getElementById("addNoteButton").disabled = false;
  }
});

document.getElementById("editProfileButton").addEventListener("click", () => {
  fillEditForm();
  setMessage(document.getElementById("editProfileMessage"), "");
  document.getElementById("editProfileDialog").showModal();
});

document.getElementById("editProfileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const firstName = text(formData.get("firstName"));
  const lastName = text(formData.get("lastName"));
  const email = text(formData.get("email")).toLowerCase();
  const mobile = normalizeMobile(formData.get("mobile"));
  const message = document.getElementById("editProfileMessage");
  const saveButton = document.getElementById("saveProfileButton");

  if (!firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || mobile.length !== 10) {
    setMessage(message, "Enter first name, valid email and 10-digit mobile number.", "error");
    return;
  }

  saveButton.disabled = true;
  setMessage(message, "Saving profile changes…", "info");
  try {
    await updateDoc(doc(db, "users", clientId), {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      email,
      mobile,
      dob: text(formData.get("dob")),
      city: text(formData.get("city")),
      pincode: text(formData.get("pincode")),
      annualIncome: text(formData.get("annualIncome")),
      riskTolerance: text(formData.get("riskTolerance")),
      broker: text(formData.get("broker")),
      tradingBroker: text(formData.get("tradingBroker")),
      investmentAmount: text(formData.get("investmentAmount")),
      address: text(formData.get("address")),
      updatedAt: serverTimestamp(),
      updatedBy: currentAdmin?.email || ""
    });
    await logActivity("client_profile_updated", "Client profile information was updated.");
    setMessage(message, "Profile updated successfully.", "success");
    setTimeout(() => document.getElementById("editProfileDialog").close(), 700);
  } catch (error) {
    setMessage(message, error.message || "Profile could not be updated.", "error");
  } finally {
    saveButton.disabled = false;
  }
});

document.querySelectorAll("[data-coming-soon]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("moduleNotice").showModal();
  });
});


const ALLOWED_SERVICES = new Set([
  "Portfolio Management Service",
  "Wealth Management",
  "Compounding Strategy"
]);

function parseAmount(value) {
  const cleaned = String(value ?? "").replace(/[₹,\s]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount >= 0 ? amount : NaN;
}

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function serviceStatusClass(status) {
  return ["pending", "active", "paused", "expired", "cancelled"].includes(status)
    ? status
    : "pending";
}

function renewalLabel(status) {
  return {
    not_due: "Not due",
    due_soon: "Due soon",
    renewal_pending: "Renewal pending",
    renewed: "Renewed",
    not_renewing: "Not renewing"
  }[status] || "Not due";
}

function serviceDateToTimestamp(dateString) {
  if (!dateString) return null;
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(dateString) {
  const expiry = serviceDateToTimestamp(dateString);
  if (!expiry) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

function renderServiceMetrics(records) {
  const active = records.filter((item) => item.serviceStatus === "active").length;
  const expiring = records.filter((item) => {
    if (item.serviceStatus !== "active") return false;
    const remaining = daysUntil(item.expiryDate);
    return remaining !== null && remaining >= 0 && remaining <= 30;
  }).length;

  document.getElementById("assignedServiceCount").textContent = String(records.length);
  document.getElementById("activeServiceCount").textContent = String(active);
  document.getElementById("expiringServiceCount").textContent = String(expiring);
}

function renderServices(records) {
  const container = document.getElementById("serviceList");
  renderServiceMetrics(records);

  if (!records.length) {
    container.innerHTML = `
      <div class="empty-service-state">
        <span>◇</span>
        <h3>No service assigned</h3>
        <p>Assign Portfolio Management Service, Wealth Management or Compounding Strategy to this client.</p>
        <button class="primary-action" type="button" data-open-service>Assign first service</button>
      </div>
    `;
    container.querySelector("[data-open-service]")?.addEventListener("click", openNewServiceDialog);
    return;
  }

  container.innerHTML = records.map((service) => {
    const remaining = daysUntil(service.expiryDate);
    let expiryText = service.expiryDate ? `Expires ${escapeHtml(service.expiryDate)}` : "No expiry date";
    if (remaining !== null && remaining >= 0 && remaining <= 30) {
      expiryText += ` · ${remaining} day${remaining === 1 ? "" : "s"} remaining`;
    } else if (remaining !== null && remaining < 0) {
      expiryText += " · Expired";
    }

    return `
      <article class="service-record-card">
        <div class="service-record-head">
          <div>
            <span class="service-icon">◇</span>
            <div>
              <h3>${escapeHtml(service.serviceName)}</h3>
              <p>${escapeHtml(service.assignedAdvisor || "No advisor assigned")}</p>
            </div>
          </div>
          <span class="service-status ${serviceStatusClass(service.serviceStatus)}">${escapeHtml(service.serviceStatus || "pending")}</span>
        </div>

        <div class="service-record-grid">
          <div><small>START DATE</small><strong>${escapeHtml(service.startDate || "—")}</strong></div>
          <div><small>EXPIRY</small><strong>${expiryText}</strong></div>
          <div><small>INVESTMENT</small><strong>${escapeHtml(formatCurrency(service.investmentAmount))}</strong></div>
          <div><small>SERVICE FEE</small><strong>${escapeHtml(formatCurrency(service.serviceFee))}</strong></div>
          <div><small>RENEWAL</small><strong>${escapeHtml(renewalLabel(service.renewalStatus))}</strong></div>
        </div>

        ${service.internalRemarks ? `<p class="service-remarks">${escapeHtml(service.internalRemarks)}</p>` : ""}

        <div class="service-record-actions">
          <button class="secondary-action" type="button" data-edit-service="${escapeHtml(service.id)}">Edit</button>
          ${service.serviceStatus === "active"
            ? `<button class="warning-action" type="button" data-service-status="${escapeHtml(service.id)}" data-next-status="paused">Pause</button>`
            : service.serviceStatus === "paused"
              ? `<button class="primary-action" type="button" data-service-status="${escapeHtml(service.id)}" data-next-status="active">Reactivate</button>`
              : ""}
          ${service.serviceStatus !== "cancelled"
            ? `<button class="danger-action" type="button" data-service-status="${escapeHtml(service.id)}" data-next-status="cancelled">Cancel service</button>`
            : ""}
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-edit-service]").forEach((button) => {
    button.addEventListener("click", () => openEditServiceDialog(button.dataset.editService));
  });

  container.querySelectorAll("[data-service-status]").forEach((button) => {
    button.addEventListener("click", () => changeServiceStatus(
      button.dataset.serviceStatus,
      button.dataset.nextStatus
    ));
  });
}

function subscribeServices() {
  const servicesQuery = query(
    collection(db, "users", clientId, "services"),
    orderBy("createdAt", "desc")
  );

  unsubscribeServices = onSnapshot(servicesQuery, (snapshot) => {
    const records = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => ALLOWED_SERVICES.has(item.serviceName));

    serviceRecords = new Map(records.map((item) => [item.id, item]));
    renderServices(records);
  }, (error) => {
    console.warn("Services listener failed:", error);
    document.getElementById("serviceList").innerHTML =
      '<div class="timeline-empty">Assigned services could not be loaded.</div>';
  });
}

function resetServiceForm() {
  const form = document.getElementById("serviceForm");
  form.reset();
  form.elements.serviceRecordId.value = "";
  form.elements.serviceStatus.value = "active";
  form.elements.renewalStatus.value = "not_due";
  const today = new Date();
  form.elements.startDate.value = today.toISOString().slice(0, 10);
  setMessage(document.getElementById("serviceFormMessage"), "");
}

function openNewServiceDialog() {
  resetServiceForm();
  document.getElementById("serviceDialogEyebrow").textContent = "ASSIGN SERVICE";
  document.getElementById("serviceDialogTitle").textContent = "Assign client service";
  document.getElementById("saveServiceButton").textContent = "Save service";
  document.getElementById("serviceDialog").showModal();
}

function openEditServiceDialog(recordId) {
  const service = serviceRecords.get(recordId);
  if (!service) return;

  resetServiceForm();
  const form = document.getElementById("serviceForm");
  form.elements.serviceRecordId.value = recordId;
  form.elements.serviceName.value = service.serviceName || "";
  form.elements.startDate.value = service.startDate || "";
  form.elements.expiryDate.value = service.expiryDate || "";
  form.elements.investmentAmount.value = service.investmentAmount ?? "";
  form.elements.serviceFee.value = service.serviceFee ?? "";
  form.elements.assignedAdvisor.value = service.assignedAdvisor || "";
  form.elements.serviceStatus.value = service.serviceStatus || "pending";
  form.elements.renewalStatus.value = service.renewalStatus || "not_due";
  form.elements.internalRemarks.value = service.internalRemarks || "";

  document.getElementById("serviceDialogEyebrow").textContent = "EDIT SERVICE";
  document.getElementById("serviceDialogTitle").textContent = service.serviceName;
  document.getElementById("saveServiceButton").textContent = "Update service";
  document.getElementById("serviceDialog").showModal();
}

async function changeServiceStatus(recordId, nextStatus) {
  const service = serviceRecords.get(recordId);
  if (!service) return;

  if (nextStatus === "cancelled") {
    const confirmed = confirm(`Cancel ${service.serviceName} for this client?`);
    if (!confirmed) return;
  }

  try {
    await updateDoc(doc(db, "users", clientId, "services", recordId), {
      serviceStatus: nextStatus,
      statusUpdatedAt: serverTimestamp(),
      statusUpdatedBy: currentAdmin?.email || "",
      updatedAt: serverTimestamp()
    });

    await logActivity(
      "service_status_changed",
      `${service.serviceName} status changed from ${service.serviceStatus || "pending"} to ${nextStatus}.`,
      { serviceId: recordId, serviceName: service.serviceName, nextStatus }
    );
  } catch (error) {
    alert(error.message || "Service status could not be updated.");
  }
}

document.getElementById("assignServiceButton").addEventListener("click", openNewServiceDialog);

document.getElementById("serviceForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const recordId = text(formData.get("serviceRecordId"));
  const serviceName = text(formData.get("serviceName"));
  const startDate = text(formData.get("startDate"));
  const expiryDate = text(formData.get("expiryDate"));
  const investmentAmount = parseAmount(formData.get("investmentAmount"));
  const serviceFee = parseAmount(formData.get("serviceFee"));
  const message = document.getElementById("serviceFormMessage");
  const saveButton = document.getElementById("saveServiceButton");

  if (!ALLOWED_SERVICES.has(serviceName)) {
    setMessage(message, "Select one of the three approved services.", "error");
    return;
  }

  if (!startDate || !expiryDate) {
    setMessage(message, "Start date and expiry date are required.", "error");
    return;
  }

  if (new Date(`${expiryDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
    setMessage(message, "Expiry date cannot be earlier than start date.", "error");
    return;
  }

  if (Number.isNaN(investmentAmount) || Number.isNaN(serviceFee)) {
    setMessage(message, "Investment amount and service fee must contain valid numbers.", "error");
    return;
  }

  const payload = {
    serviceName,
    startDate,
    expiryDate,
    investmentAmount,
    serviceFee,
    assignedAdvisor: text(formData.get("assignedAdvisor")),
    serviceStatus: text(formData.get("serviceStatus")) || "pending",
    renewalStatus: text(formData.get("renewalStatus")) || "not_due",
    internalRemarks: text(formData.get("internalRemarks")),
    updatedAt: serverTimestamp(),
    updatedBy: currentAdmin?.email || ""
  };

  saveButton.disabled = true;
  setMessage(message, recordId ? "Updating service…" : "Assigning service…", "info");

  try {
    if (recordId) {
      await updateDoc(doc(db, "users", clientId, "services", recordId), payload);
      await logActivity(
        "service_assignment_updated",
        `${serviceName} assignment was updated.`,
        { serviceId: recordId, serviceName }
      );
    } else {
      const created = await addDoc(collection(db, "users", clientId, "services"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: currentAdmin?.email || ""
      });
      await logActivity(
        "service_assigned",
        `${serviceName} was assigned to the client.`,
        { serviceId: created.id, serviceName }
      );
    }

    setMessage(message, recordId ? "Service updated successfully." : "Service assigned successfully.", "success");
    setTimeout(() => document.getElementById("serviceDialog").close(), 650);
  } catch (error) {
    setMessage(message, error.message || "Service could not be saved.", "error");
  } finally {
    saveButton.disabled = false;
  }
});


window.addEventListener("beforeunload", () => {
  unsubscribeClient?.();
  unsubscribeNotes?.();
  unsubscribeActivity?.();
  unsubscribeServices?.();
});
