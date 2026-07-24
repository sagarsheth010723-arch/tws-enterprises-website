import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db, logoutAdmin, observeAuth, verifyAdmin } from "./admin-auth.js";

const PAGE_SIZE = 20;
const MAX_PREVIEW_ROWS = 100;

const ALLOWED_SERVICES = new Set([
  "Portfolio Management Service",
  "Wealth Management",
  "Compounding Strategy"
]);

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeIsoDate(value) {
  const raw = normalizeText(value);
  if (!raw) return "";

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);

  const parts = raw.split(/[\/\-.]/).map((part) => part.trim());
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const parsed = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  return "";
}

function serviceRecordPayload(serviceName, startDate, investmentAmount, source) {
  return {
    serviceName,
    startDate,
    expiryDate: "",
    investmentAmount: normalizeText(investmentAmount),
    serviceFee: null,
    assignedAdvisor: "",
    serviceStatus: "pending",
    renewalStatus: "not_due",
    internalRemarks: `Automatically assigned from ${source}.`,
    assignmentSource: source,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: currentAdmin?.email || "",
    updatedBy: currentAdmin?.email || ""
  };
}
function amountNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function dashboardRecordPayload(fullName, investmentAmount, accountStatus) {
  return {
    userName: normalizeText(fullName),
    accountStatus: normalizeText(accountStatus || "pending").toLowerCase(),
    investmentAmount: amountNumber(investmentAmount),
    todayPL: 0,
    todayCommission: 0,
    totalProfit: 0,
    paymentStatus: "Not Available",
    lastUpdated: "Not Updated",
    remarks: "Welcome to TWS Connect.",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function paymentRecordPayload() {
  return {
    todayCommission: 0,
    paymentStatus: "Not Available",
    totalPaid: 0,
    totalPending: 0,
    lastUpdated: "Not Updated",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}



const gate = document.getElementById("authGate");
const shell = document.getElementById("adminShell");
const adminName = document.getElementById("adminName");
const adminEmail = document.getElementById("adminEmail");
const adminAvatar = document.getElementById("adminAvatar");
const logoutButton = document.getElementById("logoutButton");
const menuButton = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("adminSidebar");

const loadingState = document.getElementById("clientsLoading");
const errorState = document.getElementById("clientsError");
const errorText = document.getElementById("clientsErrorText");
const emptyState = document.getElementById("clientsEmpty");
const tableWrap = document.getElementById("clientTableWrap");
const tableBody = document.getElementById("clientTableBody");
const resultCount = document.getElementById("resultCount");
const paginationRow = document.getElementById("paginationRow");
const paginationInfo = document.getElementById("paginationInfo");
const previousPageButton = document.getElementById("previousPageButton");
const nextPageButton = document.getElementById("nextPageButton");
const searchInput = document.getElementById("clientSearchInput");
const statusFilter = document.getElementById("statusFilter");
const sourceFilter = document.getElementById("sourceFilter");
const selectAllFilteredClients = document.getElementById("selectAllFilteredClients");
const selectCurrentPageClients = document.getElementById("selectCurrentPageClients");
const deleteSelectedClientsButton = document.getElementById("deleteSelectedClientsButton");
const selectionCount = document.getElementById("selectionCount");

const totalMetric = document.getElementById("totalClientsMetric");
const appMetric = document.getElementById("appClientsMetric");
const excelMetric = document.getElementById("excelClientsMetric");
const pendingMetric = document.getElementById("pendingClientsMetric");

const addDialog = document.getElementById("addClientDialog");
const addForm = document.getElementById("addClientForm");
const addStatus = document.getElementById("addClientStatus");
const saveClientButton = document.getElementById("saveClientButton");

const importDialog = document.getElementById("importDialog");
const excelFileInput = document.getElementById("excelFileInput");
const uploadDropzone = document.getElementById("uploadDropzone");
const importSummary = document.getElementById("importSummary");
const importOptions = document.getElementById("importOptions");
const importPreviewWrap = document.getElementById("importPreviewWrap");
const importPreviewBody = document.getElementById("importPreviewBody");
const importStatus = document.getElementById("importStatus");
const confirmImportButton = document.getElementById("confirmImportButton");
const downloadErrorReportButton = document.getElementById("downloadErrorReportButton");
const skipDuplicatesCheckbox = document.getElementById("skipDuplicatesCheckbox");

const detailsDialog = document.getElementById("clientDetailsDialog");
const detailName = document.getElementById("detailClientName");
const detailSubtitle = document.getElementById("detailClientSubtitle");
const detailGrid = document.getElementById("clientDetailGrid");
const detailStatusSelect = document.getElementById("detailStatusSelect");
const detailStatusMessage = document.getElementById("detailStatusMessage");

let currentAdmin = null;
let allClients = [];
let filteredClients = [];
let currentPage = 1;
let importRows = [];
let selectedClient = null;
let unsubscribeClients = null;
const selectedClientIds = new Set();
let bulkDeleteInProgress = false;

function initials(name, email) {
  const source = String(name || email || "TWS Admin").trim();
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeMobile(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function firstValue(data, keys, fallback = "") {
  for (const key of keys) {
    if (data?.[key] !== undefined && data?.[key] !== null && String(data[key]).trim() !== "") {
      return data[key];
    }
  }
  return fallback;
}

function clientView(id, raw) {
  const firstName = normalizeText(firstValue(raw, ["firstName", "first_name", "fname"]));
  const lastName = normalizeText(firstValue(raw, ["lastName", "last_name", "lname"]));
  const fullName = normalizeText(firstValue(raw, ["fullName", "name", "displayName"], `${firstName} ${lastName}`)) || "Unnamed client";
  const email = normalizeEmail(firstValue(raw, ["email", "emailAddress"]));
  const mobile = normalizeMobile(firstValue(raw, ["mobile", "phone", "phoneNumber", "contactNumber"]));
  const status = normalizeText(firstValue(raw, ["accountStatus", "profileStatus", "status"], "pending")).toLowerCase();
  const source = normalizeText(firstValue(raw, ["source"], raw?.authStatus === "active" ? "app_registration" : "app_registration"));
  const registeredAt = firstValue(raw, ["createdAt", "registeredAt", "registrationDate", "importedAt"]);
  return { id, raw, firstName, lastName, fullName, email, mobile, status, source, registeredAt };
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = dateValue(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

function sourceLabel(source) {
  if (source === "excel_import") return "Excel import";
  if (source === "manual_admin") return "Manual entry";
  return "App registration";
}

function statusClass(status) {
  return ["active", "inactive", "suspended", "pending"].includes(status) ? status : "pending";
}

function showShell(user, profile) {
  const displayName = profile?.name || user.displayName || "TWS Admin";
  currentAdmin = { uid: user.uid, email: user.email || "", name: displayName };
  adminName.textContent = displayName;
  adminEmail.textContent = user.email || profile?.email || "";
  adminAvatar.textContent = initials(displayName, user.email);
  gate.hidden = true;
  shell.hidden = false;
}

function setTableState(kind, message = "") {
  loadingState.hidden = kind !== "loading";
  errorState.hidden = kind !== "error";
  emptyState.hidden = kind !== "empty";
  tableWrap.hidden = kind !== "ready";
  paginationRow.hidden = kind !== "ready";
  if (message) errorText.textContent = message;
}

function updateMetrics() {
  totalMetric.textContent = allClients.length.toLocaleString("en-IN");
  appMetric.textContent = allClients.filter((client) => client.source === "app_registration").length.toLocaleString("en-IN");
  excelMetric.textContent = allClients.filter((client) => client.source === "excel_import").length.toLocaleString("en-IN");
  pendingMetric.textContent = allClients.filter((client) => client.status === "pending").length.toLocaleString("en-IN");
}

function applyFilters() {
  const search = normalizeText(searchInput.value).toLowerCase();
  const status = statusFilter.value;
  const source = sourceFilter.value;

  filteredClients = allClients.filter((client) => {
    const haystack = [
      client.fullName, client.email, client.mobile, client.id,
      firstValue(client.raw, ["clientId", "clientID", "loginId"])
    ].join(" ").toLowerCase();

    return (!search || haystack.includes(search))
      && (status === "all" || client.status === status)
      && (source === "all" || client.source === source);
  });

  currentPage = 1;
  renderClients();
}

function currentPageClients() {
  const start = (currentPage - 1) * PAGE_SIZE;
  return filteredClients.slice(start, start + PAGE_SIZE);
}

function updateSelectionControls() {
  const validIds = new Set(allClients.map((client) => client.id));
  [...selectedClientIds].forEach((id) => {
    if (!validIds.has(id)) selectedClientIds.delete(id);
  });

  const selectedCountValue = selectedClientIds.size;
  selectionCount.textContent = `${selectedCountValue.toLocaleString("en-IN")} selected`;
  deleteSelectedClientsButton.textContent = `Delete selected (${selectedCountValue.toLocaleString("en-IN")})`;
  deleteSelectedClientsButton.disabled = selectedCountValue === 0 || bulkDeleteInProgress;

  const filteredIds = filteredClients.map((client) => client.id);
  const filteredSelected = filteredIds.filter((id) => selectedClientIds.has(id)).length;
  selectAllFilteredClients.checked = filteredIds.length > 0 && filteredSelected === filteredIds.length;
  selectAllFilteredClients.indeterminate = filteredSelected > 0 && filteredSelected < filteredIds.length;
  selectAllFilteredClients.disabled = filteredIds.length === 0 || bulkDeleteInProgress;

  const pageIds = currentPageClients().map((client) => client.id);
  const pageSelected = pageIds.filter((id) => selectedClientIds.has(id)).length;
  selectCurrentPageClients.checked = pageIds.length > 0 && pageSelected === pageIds.length;
  selectCurrentPageClients.indeterminate = pageSelected > 0 && pageSelected < pageIds.length;
  selectCurrentPageClients.disabled = pageIds.length === 0 || bulkDeleteInProgress;
}

function setClientSelected(clientId, selected) {
  if (selected) selectedClientIds.add(clientId);
  else selectedClientIds.delete(clientId);
  updateSelectionControls();
}

function renderClients() {
  resultCount.textContent = `${filteredClients.length.toLocaleString("en-IN")} client${filteredClients.length === 1 ? "" : "s"}`;

  if (!filteredClients.length) {
    setTableState("empty");
    updateSelectionControls();
    return;
  }

  setTableState("ready");
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredClients.slice(start, start + PAGE_SIZE);

  tableBody.innerHTML = pageRows.map((client) => `
    <tr data-client-row="${escapeHtml(client.id)}">
      <td class="select-column"><input class="client-row-checkbox" type="checkbox" data-client-select="${escapeHtml(client.id)}" aria-label="Select ${escapeHtml(client.fullName)}" ${selectedClientIds.has(client.id) ? "checked" : ""}></td>
      <td>
        <div class="client-identity">
          <span class="client-avatar">${escapeHtml(initials(client.fullName, client.email))}</span>
          <div><strong>${escapeHtml(client.fullName)}</strong><small>${escapeHtml(firstValue(client.raw, ["clientId", "clientID"], client.id))}</small></div>
        </div>
      </td>
      <td><strong class="table-main">${escapeHtml(client.mobile || "—")}</strong><small>${escapeHtml(client.email || "—")}</small></td>
      <td><span class="source-badge ${escapeHtml(client.source)}">${escapeHtml(sourceLabel(client.source))}</span></td>
      <td><span class="status-badge ${statusClass(client.status)}">${escapeHtml(client.status || "pending")}</span></td>
      <td><strong class="table-main">${escapeHtml(formatDate(client.registeredAt))}</strong><small>${client.raw?.authStatus === "active" ? "Login active" : client.source === "excel_import" ? "No app login" : "Firebase record"}</small></td>
      <td class="align-right"><a class="row-action" href="./client-profile.html?id=${encodeURIComponent(client.id)}">View profile</a></td>
    </tr>
  `).join("");

  tableBody.querySelectorAll("[data-client-select]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => setClientSelected(checkbox.dataset.clientSelect, checkbox.checked));
  });

  paginationInfo.textContent = `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filteredClients.length)} of ${filteredClients.length}`;
  previousPageButton.disabled = currentPage <= 1;
  nextPageButton.disabled = currentPage >= totalPages;
  updateSelectionControls();
}

function subscribeToClients() {
  setTableState("loading");
  const usersCollection = collection(db, "users");

  unsubscribeClients = onSnapshot(usersCollection, (snapshot) => {
    allClients = snapshot.docs.map((snapshotDoc) => clientView(snapshotDoc.id, snapshotDoc.data()));
    allClients.sort((a, b) => {
      const left = dateValue(a.registeredAt)?.getTime() || 0;
      const right = dateValue(b.registeredAt)?.getTime() || 0;
      return right - left;
    });
    updateMetrics();
    applyFilters();
  }, (error) => {
    console.error("Clients listener failed:", error);
    setTableState("error", `${error.code || "Firebase error"}: ${error.message || "Unable to read users collection."}`);
  });
}

function setModalStatus(element, message, type = "info") {
  element.textContent = message;
  element.className = `modal-status ${type}`;
  element.hidden = !message;
}

function generateDocumentId(prefix = "client") {
  const random = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}_${Date.now()}_${random[0].toString(36)}${random[1].toString(36)}`;
}

async function saveManualClient(formData) {
  const firstName = normalizeText(formData.get("firstName"));
  const lastName = normalizeText(formData.get("lastName"));
  const email = normalizeEmail(formData.get("email"));
  const mobile = normalizeMobile(formData.get("mobile"));
  const serviceName = normalizeText(formData.get("serviceName"));
  const registrationDate = todayIsoDate();

  if (!firstName || !email || mobile.length !== 10) {
    throw new Error("Enter first name, a valid email and a 10-digit mobile number.");
  }
  if (!ALLOWED_SERVICES.has(serviceName)) {
    throw new Error("Select one of the three approved services.");
  }

  const duplicate = allClients.find((client) => client.email === email || client.mobile === mobile);
  if (duplicate) throw new Error("A client with this email or mobile number already exists.");

  const documentId = generateDocumentId("manual");
  const serviceId = generateDocumentId("service");
  const investmentAmount = normalizeText(formData.get("investmentAmount"));
  const batch = writeBatch(db);

  batch.set(doc(db, "users", documentId), {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email,
    mobile,
    city: normalizeText(formData.get("city")),
    pincode: normalizeText(formData.get("pincode")),
    annualIncome: normalizeText(formData.get("annualIncome")),
    riskTolerance: normalizeText(formData.get("riskTolerance")),
    broker: normalizeText(formData.get("broker")),
    investmentAmount,
    address: normalizeText(formData.get("address")),
    internalNotes: normalizeText(formData.get("internalNotes")),
    serviceInterest: serviceName,
    registrationDate,
    accountStatus: "pending",
    source: "manual_admin",
    authStatus: "not_created",
    createdAt: serverTimestamp(),
    importedBy: currentAdmin?.email || "",
    importedByUid: currentAdmin?.uid || ""
  });

  batch.set(
    doc(db, "users", documentId, "services", serviceId),
    serviceRecordPayload(serviceName, registrationDate, investmentAmount, "manual client creation")
  );
  batch.set(
    doc(db, "dashboard", documentId),
    dashboardRecordPayload(`${firstName} ${lastName}`.trim(), investmentAmount, "pending")
  );
  batch.set(doc(db, "payments", documentId), paymentRecordPayload());

  await batch.commit();
}

function templateRows() {
  return [{
    "First Name": "Sagar",
    "Last Name": "Sheth",
    "Email": "client@example.com",
    "Mobile": "9876543210",
    "DOB": "24/07/1990",
    "Address": "Full residential address",
    "City": "Mumbai",
    "Pincode": "400001",
    "Annual Income": "₹10 Lakhs - ₹25 Lakhs",
    "Risk Tolerance": "Medium",
    "Broker": "Zerodha",
    "Trading Preferences": "Equity Cash, Index Options",
    "Login ID": "",
    "Investment Amount": "500000",
    "Service Name": "Portfolio Management Service",
    "Registration Date": "24/07/2026",
    "Account Status": "pending",
    "Internal Notes": ""
  }];
}

function downloadWorkbook(rows, filename, sheetName = "Clients") {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

function canonicalRow(raw, rowNumber) {
  const normalizedMap = new Map();
  Object.entries(raw || {}).forEach(([key, value]) => {
    normalizedMap.set(String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, ""), value);
  });
  const value = (...keys) => {
    for (const key of keys) {
      const found = normalizedMap.get(key);
      if (found !== undefined && found !== null && String(found).trim() !== "") return found;
    }
    return "";
  };

  const firstName = normalizeText(value("firstname", "fname"));
  const lastName = normalizeText(value("lastname", "lname"));
  const email = normalizeEmail(value("email", "emailaddress"));
  const mobile = normalizeMobile(value("mobile", "mobilenumber", "phone", "phonenumber", "contactnumber"));
  const status = normalizeText(value("accountstatus", "status") || "pending").toLowerCase();
  const serviceName = normalizeText(value("servicename", "service", "serviceinterest"));
  const registrationDate = normalizeIsoDate(value("registrationdate", "registeredat", "startdate")) || todayIsoDate();
  const issues = [];

  if (!firstName) issues.push("First Name required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push("Invalid email");
  if (mobile.length !== 10) issues.push("Mobile must be 10 digits");
  if (!["pending", "active", "inactive", "suspended"].includes(status)) issues.push("Invalid account status");
  if (!ALLOWED_SERVICES.has(serviceName)) issues.push("Invalid or missing Service Name");

  const duplicate = allClients.find((client) => client.email === email || client.mobile === mobile);

  return {
    rowNumber,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email,
    mobile,
    dob: normalizeText(value("dob", "dateofbirth")),
    address: normalizeText(value("address", "residentialaddress")),
    city: normalizeText(value("city", "citystate")),
    pincode: normalizeText(value("pincode", "pin")),
    annualIncome: normalizeText(value("annualincome")),
    riskTolerance: normalizeText(value("risktolerance")),
    broker: normalizeText(value("broker")),
    tradingPreferences: normalizeText(value("tradingpreferences", "segments")),
    loginId: normalizeText(value("loginid")),
    investmentAmount: normalizeText(value("investmentamount")),
    serviceName,
    registrationDate,
    accountStatus: status,
    internalNotes: normalizeText(value("internalnotes", "notes")),
    duplicate: Boolean(duplicate),
    duplicateId: duplicate?.id || "",
    issues
  };
}

function updateImportSummary() {
  const valid = importRows.filter((row) => !row.issues.length && !row.duplicate).length;
  const duplicates = importRows.filter((row) => row.duplicate).length;
  const invalid = importRows.filter((row) => row.issues.length).length;

  document.getElementById("importTotalRows").textContent = importRows.length;
  document.getElementById("importValidRows").textContent = valid;
  document.getElementById("importDuplicateRows").textContent = duplicates;
  document.getElementById("importInvalidRows").textContent = invalid;

  importPreviewBody.innerHTML = importRows.slice(0, MAX_PREVIEW_ROWS).map((row) => {
    const state = row.issues.length ? "Invalid" : row.duplicate ? "Duplicate" : "Ready";
    const issue = row.issues.join("; ") || (row.duplicate ? "Email/mobile already exists" : "—");
    return `<tr>
      <td>${row.rowNumber}</td>
      <td>${escapeHtml(row.fullName || "—")}</td>
      <td>${escapeHtml(row.email || "—")}</td>
      <td>${escapeHtml(row.mobile || "—")}</td>
      <td>${escapeHtml(row.serviceName || "—")}</td>
      <td><span class="import-row-state ${state.toLowerCase()}">${state}</span></td>
      <td>${escapeHtml(issue)}</td>
    </tr>`;
  }).join("");

  importSummary.hidden = false;
  importOptions.hidden = false;
  importPreviewWrap.hidden = false;
  downloadErrorReportButton.hidden = !(duplicates || invalid);
  confirmImportButton.disabled = valid === 0;
  setModalStatus(importStatus, importRows.length > MAX_PREVIEW_ROWS
    ? `Previewing the first ${MAX_PREVIEW_ROWS} rows. All ${importRows.length} rows will be processed.`
    : "Review the file summary before confirming the import.", "info");
}

async function parseExcelFile(file) {
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) throw new Error("File is too large. Use a file below 12 MB.");

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: false });

  if (!rows.length) throw new Error("No data rows were found in the first worksheet.");
  if (rows.length > 5000) throw new Error("This build supports up to 5,000 rows in one import.");

  importRows = rows.map((row, index) => canonicalRow(row, index + 2));
  updateImportSummary();
}

async function importValidRows() {
  const skipDuplicates = skipDuplicatesCheckbox.checked;
  const candidates = importRows.filter((row) =>
    !row.issues.length && (!row.duplicate || !skipDuplicates)
  );

  if (!candidates.length) throw new Error("There are no valid rows available to import.");

  confirmImportButton.disabled = true;
  setModalStatus(importStatus, `Importing ${candidates.length} clients into Firebase…`, "info");

  const batchId = `excel_${Date.now()}`;
  let imported = 0;
  // Four Firestore writes are created for each imported client.
  // Keep the batch safely below Firestore's 500-write limit.
  const chunkSize = 100;

  for (let start = 0; start < candidates.length; start += chunkSize) {
    const batch = writeBatch(db);
    const chunk = candidates.slice(start, start + chunkSize);

    chunk.forEach((row) => {
      const documentId = generateDocumentId("excel");
      const serviceId = generateDocumentId("service");
      batch.set(doc(db, "users", documentId), {
        firstName: row.firstName,
        lastName: row.lastName,
        fullName: row.fullName,
        email: row.email,
        mobile: row.mobile,
        dob: row.dob,
        address: row.address,
        city: row.city,
        pincode: row.pincode,
        annualIncome: row.annualIncome,
        riskTolerance: row.riskTolerance,
        broker: row.broker,
        tradingPreferences: row.tradingPreferences,
        loginId: row.loginId,
        investmentAmount: row.investmentAmount,
        serviceInterest: row.serviceName,
        registrationDate: row.registrationDate,
        accountStatus: row.accountStatus,
        internalNotes: row.internalNotes,
        source: "excel_import",
        authStatus: "not_created",
        importedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        importedBy: currentAdmin?.email || "",
        importedByUid: currentAdmin?.uid || "",
        importBatchId: batchId
      });

      batch.set(
        doc(db, "users", documentId, "services", serviceId),
        serviceRecordPayload(
          row.serviceName,
          row.registrationDate,
          row.investmentAmount,
          "Excel import"
        )
      );
      batch.set(
        doc(db, "dashboard", documentId),
        dashboardRecordPayload(row.fullName, row.investmentAmount, row.accountStatus)
      );
      batch.set(doc(db, "payments", documentId), paymentRecordPayload());
    });

    await batch.commit();
    imported += chunk.length;
    setModalStatus(importStatus, `Imported ${imported} of ${candidates.length} clients…`, "info");
  }

  const duplicateCount = importRows.filter((row) => row.duplicate).length;
  const invalidCount = importRows.filter((row) => row.issues.length).length;
  setModalStatus(
    importStatus,
    `Import completed: ${imported} saved, ${skipDuplicates ? duplicateCount : 0} duplicates skipped, ${invalidCount} invalid rows skipped.`,
    "success"
  );
  confirmImportButton.disabled = true;
}

function resetImport() {
  importRows = [];
  excelFileInput.value = "";
  importSummary.hidden = true;
  importOptions.hidden = true;
  importPreviewWrap.hidden = true;
  importPreviewBody.innerHTML = "";
  confirmImportButton.disabled = true;
  downloadErrorReportButton.hidden = true;
  setModalStatus(importStatus, "");
}

function showClientDetails(client) {
  selectedClient = client;
  detailName.textContent = client.fullName;
  detailSubtitle.textContent = `${sourceLabel(client.source)} · ${client.id}`;
  detailStatusSelect.value = statusClass(client.status);

  const fields = [
    ["Email", client.email || "—"],
    ["Mobile", client.mobile || "—"],
    ["Date of Birth", firstValue(client.raw, ["dob", "dateOfBirth"], "—")],
    ["Address", firstValue(client.raw, ["address", "residentialAddress"], "—")],
    ["City", firstValue(client.raw, ["city"], "—")],
    ["Pincode", firstValue(client.raw, ["pincode", "pin"], "—")],
    ["Annual Income", firstValue(client.raw, ["annualIncome"], "—")],
    ["Risk Tolerance", firstValue(client.raw, ["riskTolerance"], "—")],
    ["Broker", firstValue(client.raw, ["broker", "tradingBroker"], "—")],
    ["Investment Amount", firstValue(client.raw, ["investmentAmount"], "—")],
    ["Trading Preferences", firstValue(client.raw, ["tradingPreferences"], "—")],
    ["Registered", formatDate(client.registeredAt)]
  ];

  detailGrid.innerHTML = fields.map(([label, value]) =>
    `<article><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></article>`
  ).join("");

  setModalStatus(detailStatusMessage, "");
  detailsDialog.showModal();
}

async function updateClientStatus() {
  if (!selectedClient) return;
  const nextStatus = detailStatusSelect.value;
  try {
    document.getElementById("saveStatusButton").disabled = true;
    setModalStatus(detailStatusMessage, "Updating client status…", "info");
    await updateDoc(doc(db, "users", selectedClient.id), {
      accountStatus: nextStatus,
      statusUpdatedAt: serverTimestamp(),
      statusUpdatedBy: currentAdmin?.email || ""
    });
    setModalStatus(detailStatusMessage, "Client status updated successfully.", "success");
  } catch (error) {
    console.error("Status update failed:", error);
    setModalStatus(detailStatusMessage, error.message || "Status could not be updated.", "error");
  } finally {
    document.getElementById("saveStatusButton").disabled = false;
  }
}

async function collectCollectionDocumentRefs(collectionReference) {
  const snapshot = await getDocs(collectionReference);
  return snapshot.docs.map((item) => item.ref);
}

async function commitDeleteRefs(documentRefs) {
  const chunkSize = 400;
  for (let start = 0; start < documentRefs.length; start += chunkSize) {
    const batch = writeBatch(db);
    documentRefs.slice(start, start + chunkSize).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

async function collectClientDeleteRefs(clientId) {
  const refs = [];
  const userSubcollections = ["services", "admin_notes", "activity_logs", "documents"];
  for (const subcollection of userSubcollections) {
    refs.push(...await collectCollectionDocumentRefs(collection(db, "users", clientId, subcollection)));
  }
  refs.push(...await collectCollectionDocumentRefs(collection(db, "notifications", clientId, "items")));
  refs.push(
    doc(db, "dashboard", clientId),
    doc(db, "payments", clientId),
    doc(db, "client_meta", clientId),
    doc(db, "notifications", clientId),
    doc(db, "users", clientId)
  );
  return refs;
}

async function deleteSelectedClients() {
  const ids = [...selectedClientIds];
  if (!ids.length || bulkDeleteInProgress) return;

  const confirmed = window.confirm(
    `Delete ${ids.length} selected client${ids.length === 1 ? "" : "s"} and their related services, payments, documents, notifications and activity records?\n\nThis cannot be undone.`
  );
  if (!confirmed) return;

  bulkDeleteInProgress = true;
  updateSelectionControls();
  deleteSelectedClientsButton.textContent = "Deleting…";

  try {
    let completed = 0;
    for (const clientId of ids) {
      const refs = await collectClientDeleteRefs(clientId);
      await commitDeleteRefs(refs);
      completed += 1;
      deleteSelectedClientsButton.textContent = `Deleting ${completed}/${ids.length}`;
    }
    selectedClientIds.clear();
    window.alert(`${completed} client${completed === 1 ? "" : "s"} deleted successfully.`);
  } catch (error) {
    console.error("Bulk client deletion failed:", error);
    window.alert(error.message || "Some client records could not be deleted. Check Firestore permissions and try again.");
  } finally {
    bulkDeleteInProgress = false;
    updateSelectionControls();
  }
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
    showShell(user, result.profile);
    subscribeToClients();
  } catch (error) {
    console.error("Admin authorization failed:", error);
    gate.querySelector("p").textContent = "Unable to verify admin access. Check Firestore and reload.";
  }
});

logoutButton.addEventListener("click", logoutAdmin);
menuButton.addEventListener("click", () => sidebar.classList.toggle("open"));
searchInput.addEventListener("input", applyFilters);
statusFilter.addEventListener("change", applyFilters);
sourceFilter.addEventListener("change", applyFilters);
selectAllFilteredClients.addEventListener("change", () => {
  filteredClients.forEach((client) => {
    if (selectAllFilteredClients.checked) selectedClientIds.add(client.id);
    else selectedClientIds.delete(client.id);
  });
  renderClients();
});
selectCurrentPageClients.addEventListener("change", () => {
  currentPageClients().forEach((client) => {
    if (selectCurrentPageClients.checked) selectedClientIds.add(client.id);
    else selectedClientIds.delete(client.id);
  });
  renderClients();
});
deleteSelectedClientsButton.addEventListener("click", deleteSelectedClients);

previousPageButton.addEventListener("click", () => {
  if (currentPage > 1) { currentPage -= 1; renderClients(); }
});
nextPageButton.addEventListener("click", () => {
  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE);
  if (currentPage < totalPages) { currentPage += 1; renderClients(); }
});

document.getElementById("openAddClientButton").addEventListener("click", () => {
  addForm.reset();
  setModalStatus(addStatus, "");
  addDialog.showModal();
});

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveClientButton.disabled = true;
  setModalStatus(addStatus, "Saving client to Firebase…", "info");
  try {
    await saveManualClient(new FormData(addForm));
    setModalStatus(addStatus, "Client saved successfully.", "success");
    addForm.reset();
    setTimeout(() => addDialog.close(), 700);
  } catch (error) {
    console.error("Manual client save failed:", error);
    setModalStatus(addStatus, error.message || "Client could not be saved.", "error");
  } finally {
    saveClientButton.disabled = false;
  }
});

document.getElementById("downloadTemplateButton").addEventListener("click", () => {
  downloadWorkbook(templateRows(), "TWS_Connect_Client_Import_Template.xlsx", "Client Import");
});

document.getElementById("openImportButton").addEventListener("click", () => {
  resetImport();
  importDialog.showModal();
});
document.getElementById("closeImportButton").addEventListener("click", () => importDialog.close());
document.getElementById("chooseExcelButton").addEventListener("click", () => excelFileInput.click());
uploadDropzone.addEventListener("click", (event) => {
  if (!event.target.closest("button")) excelFileInput.click();
});
uploadDropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadDropzone.classList.add("dragging");
});
uploadDropzone.addEventListener("dragleave", () => uploadDropzone.classList.remove("dragging"));
uploadDropzone.addEventListener("drop", async (event) => {
  event.preventDefault();
  uploadDropzone.classList.remove("dragging");
  const selectedFile = event.dataTransfer?.files?.[0];
  if (!selectedFile) return;

  try {
    resetImport();

    if (typeof XLSX === "undefined") {
      throw new Error("Excel reader library did not load. Refresh the page and try again.");
    }

    await parseExcelFile(selectedFile);
  } catch (error) {
    console.error("Dropped Excel file parsing failed:", error);
    setModalStatus(importStatus, error.message || "Excel file could not be read.", "error");
  }
});
excelFileInput.addEventListener("change", async () => {
  const selectedFile = excelFileInput.files?.[0];
  if (!selectedFile) return;

  try {
    importRows = [];
    importSummary.hidden = true;
    importOptions.hidden = true;
    importPreviewWrap.hidden = true;
    importPreviewBody.innerHTML = "";
    confirmImportButton.disabled = true;
    downloadErrorReportButton.hidden = true;
    setModalStatus(importStatus, "Reading Excel file…", "info");

    if (typeof XLSX === "undefined") {
      throw new Error("Excel reader library did not load. Refresh the page and try again.");
    }

    await parseExcelFile(selectedFile);
  } catch (error) {
    console.error("Excel file parsing failed:", error);
    setModalStatus(importStatus, error.message || "Excel file could not be read.", "error");
  }
});
document.getElementById("resetImportButton").addEventListener("click", resetImport);
confirmImportButton.addEventListener("click", async () => {
  try {
    await importValidRows();
  } catch (error) {
    console.error("Excel import failed:", error);
    setModalStatus(importStatus, error.message || "Import failed.", "error");
    confirmImportButton.disabled = false;
  }
});
downloadErrorReportButton.addEventListener("click", () => {
  const rows = importRows.filter((row) => row.duplicate || row.issues.length).map((row) => ({
    "Excel Row": row.rowNumber,
    "First Name": row.firstName,
    "Last Name": row.lastName,
    "Email": row.email,
    "Mobile": row.mobile,
    "Result": row.issues.length ? "Invalid" : "Duplicate",
    "Issue": row.issues.join("; ") || "Email/mobile already exists"
  }));
  downloadWorkbook(rows, "TWS_Connect_Client_Import_Errors.xlsx", "Import Errors");
});

document.getElementById("closeDetailsButton").addEventListener("click", () => detailsDialog.close());
document.getElementById("saveStatusButton").addEventListener("click", updateClientStatus);

window.addEventListener("beforeunload", () => unsubscribeClients?.());
