/**
 * Alpha Premier — Absence Request System (Final v1.0)
 * Core Application Logic, Pure Letter Renderer, Firestore State & PDF Export
 */

const STORAGE_KEY = "APG_SYSTEM_V3_STATE";

// Helper to generate realistic signature Data URLs (SVG encoded as Data URL)
function createSignatureDataUrl(text, color = "#0c2340") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="75" viewBox="0 0 260 75">
    <path d="M18 52 Q 45 12, 72 44 T 130 35 T 195 45 Q 220 50, 242 26" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" opacity="0.85"/>
    <text x="24" y="48" font-family="Georgia, serif" font-size="22" font-style="italic" fill="${color}">${text}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

const DEFAULT_HR_SIG = createSignatureDataUrl("Jean Ashley Chico", "#0c2340");
const DEFAULT_JUAN_SIG = createSignatureDataUrl("Juan M. Dela Cruz", "#1e3a8a");
const DEFAULT_SOFIA_SIG = createSignatureDataUrl("Sofia G. Reyes", "#1e293b");

// Initial Seed State matching Section 6 Data Model
function getInitialSeedState() {
  return {
    currentUserUid: "intern-juan",
    currentScreen: "intern-dashboard", // see navigation router
    selectedRequestIdForReview: "req-2026-003",
    editingRequestId: null,
    calendarMonthOffset: 0, // 0 = Nov 2026 (current system month)
    sidebarCollapsed: false,

    settings: {
      letter: {
        signatoryName: "Ms. Jean Ashley Chico",
        signatoryTitle: "HR Officer",
        companyName: "Alpha Premier Group",
        subject: "Request for Absent",
        salutation: "Good day, Ma'am!",
        addressBlock: "SUITE 3104C Philippine Stock Exchange Centre,\nTektite East Tower, Exchange Road, Ortigas\nPasig City 1605",
        apologyParagraph: "I sincerely apologize for any inconvenience my absence may cause and assure you that I will make every effort to catch up on any missed responsibilities upon my return.",
        thankYouParagraph: "Thank you for your understanding and consideration. I appreciate your support regarding this matter.",
        hrSignature: DEFAULT_HR_SIG,
        templateVersion: "1.0",
        attachmentsEnabled: false
      }
    },

    counters: {
      "2026": { nextRefNo: 43 }
    },

    users: {
      "hr-chico": {
        uid: "hr-chico",
        name: "Ms. Jean Ashley Chico",
        email: "jachico@alphapremier.com",
        internId: "APG-HR-001",
        position: "HR Officer",
        department: "Human Resources",
        role: "hr",
        status: "active",
        requiredHours: 0,
        renderedHours: 0,
        savedSignature: DEFAULT_HR_SIG,
        createdAt: "2026-01-10T09:00:00+08:00"
      },
      "intern-juan": {
        uid: "intern-juan",
        name: "Juan Miguel Dela Cruz",
        email: "juan.delacruz@university.edu.ph",
        internId: "APG-INT-2026-014",
        position: "HR/Marketing Associate Intern",
        department: "Marketing & HR",
        role: "intern",
        memberType: "intern",
        status: "active",
        requiredHours: 480,
        renderedHours: 240,
        savedSignature: DEFAULT_JUAN_SIG,
        createdAt: "2026-09-01T08:30:00+08:00"
      },
      "intern-sofia": {
        uid: "intern-sofia",
        name: "Sofia Gabrielle Reyes",
        email: "sofia.reyes@university.edu.ph",
        internId: "APG-INT-2026-019",
        position: "Operations & Finance Intern",
        department: "Operations",
        role: "intern",
        memberType: "intern",
        status: "active",
        requiredHours: 400,
        renderedHours: 192,
        savedSignature: DEFAULT_SOFIA_SIG,
        createdAt: "2026-09-15T08:30:00+08:00"
      },
      "intern-maria": {
        uid: "intern-maria",
        name: "Maria Clara Santos",
        email: "maria.santos@university.edu.ph",
        internId: "",
        position: "",
        department: "",
        role: "intern",
        memberType: "intern",
        status: "pending",
        requiredHours: 480,
        renderedHours: 0,
        savedSignature: "",
        createdAt: "2026-11-09T14:20:00+08:00"
      },
      "emp-carlos": {
        uid: "emp-carlos",
        name: "Carlos Eduardo Mendoza",
        email: "carlos.mendoza@alphapremier.com",
        internId: "APG-EMP-2025-082",
        position: "Operations Associate",
        department: "Operations",
        role: "employee",
        memberType: "employee",
        status: "active",
        requiredHours: 0,
        renderedHours: 0,
        savedSignature: createSignatureDataUrl("Carlos E. Mendoza", "#0c2340"),
        createdAt: "2025-06-01T08:30:00+08:00"
      }
    },

    requests: {
      "req-2026-001": {
        id: "req-2026-001",
        refNo: "APG-EL-2026-0041",
        uid: "intern-juan",
        snapshot: {
          name: "Juan Miguel Dela Cruz",
          internId: "APG-INT-2026-014",
          position: "HR/Marketing Associate Intern",
          department: "Marketing & HR"
        },
        type: "full",
        date: "2026-11-05",
        startDate: null,
        endDate: null,
        days: 1,
        shift: null,
        timeRange: null,
        hoursImpact: 8,
        reasonCategory: "Academic",
        reasonDetails: "I am required to attend our mandatory Thesis Proposal Defense at the university campus in Manila, where my presence as the lead presenter is strictly required by the faculty panel.",
        attachment: null,
        internSignature: DEFAULT_JUAN_SIG,
        status: "approved",
        review: {
          byUid: "hr-chico",
          byName: "Ms. Jean Ashley Chico",
          remarks: "Approved. Best of luck with your thesis defense, Juan!",
          at: "2026-11-03T15:10:00+08:00",
          hrSignature: DEFAULT_HR_SIG
        },
        history: [
          {
            status: "submitted",
            byUid: "intern-juan",
            byName: "Juan Miguel Dela Cruz",
            remarks: "Submitted absence request.",
            at: "2026-11-03T10:15:00+08:00"
          },
          {
            status: "approved",
            byUid: "hr-chico",
            byName: "Ms. Jean Ashley Chico",
            remarks: "Approved. Best of luck with your thesis defense, Juan!",
            at: "2026-11-03T15:10:00+08:00"
          }
        ],
        createdAt: "2026-11-03T10:00:00+08:00",
        submittedAt: "2026-11-03T10:15:00+08:00",
        updatedAt: "2026-11-03T15:10:00+08:00",
        templateVersion: "1.0"
      },

      "req-2026-002": {
        id: "req-2026-002",
        refNo: "APG-EL-2026-0042",
        uid: "intern-sofia",
        snapshot: {
          name: "Sofia Gabrielle Reyes",
          internId: "APG-INT-2026-019",
          position: "Operations & Finance Intern",
          department: "Operations"
        },
        type: "half",
        date: "2026-11-12",
        startDate: null,
        endDate: null,
        days: 0.5,
        shift: "morning",
        timeRange: "8:00 AM – 12:00 PM",
        hoursImpact: 4,
        reasonCategory: "Medical",
        reasonDetails: "I have a scheduled follow-up dental surgery and orthodontic consultation at Makati Medical Center during the morning hours and will report for duty immediately in the afternoon.",
        attachment: null,
        internSignature: DEFAULT_SOFIA_SIG,
        status: "approved",
        review: {
          byUid: "hr-chico",
          byName: "Ms. Jean Ashley Chico",
          remarks: "Approved for morning half-day leave.",
          at: "2026-11-09T16:40:00+08:00",
          hrSignature: DEFAULT_HR_SIG
        },
        history: [
          {
            status: "submitted",
            byUid: "intern-sofia",
            byName: "Sofia Gabrielle Reyes",
            remarks: "Submitted half-day absence request.",
            at: "2026-11-09T11:20:00+08:00"
          },
          {
            status: "approved",
            byUid: "hr-chico",
            byName: "Ms. Jean Ashley Chico",
            remarks: "Approved for morning half-day leave.",
            at: "2026-11-09T16:40:00+08:00"
          }
        ],
        createdAt: "2026-11-09T11:15:00+08:00",
        submittedAt: "2026-11-09T11:20:00+08:00",
        updatedAt: "2026-11-09T16:40:00+08:00",
        templateVersion: "1.0"
      },

      "req-2026-003": {
        id: "req-2026-003",
        refNo: null,
        uid: "intern-juan",
        snapshot: {
          name: "Juan Miguel Dela Cruz",
          internId: "APG-INT-2026-014",
          position: "HR/Marketing Associate Intern",
          department: "Marketing & HR"
        },
        type: "multi",
        date: null,
        startDate: "2026-11-18",
        endDate: "2026-11-19",
        days: 2,
        shift: null,
        timeRange: null,
        hoursImpact: 16,
        reasonCategory: "School activity",
        reasonDetails: "Our department is holding its annual graduating batch pre-employment seminar and mock board examination at the university auditorium, which requires full two-day attendance.",
        attachment: null,
        internSignature: DEFAULT_JUAN_SIG,
        status: "submitted",
        review: null,
        history: [
          {
            status: "submitted",
            byUid: "intern-juan",
            byName: "Juan Miguel Dela Cruz",
            remarks: "Submitted multi-day leave request.",
            at: "2026-11-10T09:15:00+08:00"
          }
        ],
        createdAt: "2026-11-10T09:05:00+08:00",
        submittedAt: "2026-11-10T09:15:00+08:00",
        updatedAt: "2026-11-10T09:15:00+08:00",
        templateVersion: "1.0"
      },

      "req-2026-004": {
        id: "req-2026-004",
        refNo: null,
        uid: "intern-juan",
        snapshot: {
          name: "Juan Miguel Dela Cruz",
          internId: "APG-INT-2026-014",
          position: "HR/Marketing Associate Intern",
          department: "Marketing & HR"
        },
        type: "half",
        date: "2026-11-24",
        startDate: null,
        endDate: null,
        days: 0.5,
        shift: "afternoon",
        timeRange: "1:00 PM – 5:00 PM",
        hoursImpact: 4,
        reasonCategory: "Academic",
        reasonDetails: "I need to meet with my Faculty Coordinator at the university college dean's office to submit my midterm evaluation forms.",
        attachment: null,
        internSignature: DEFAULT_JUAN_SIG,
        status: "returned",
        review: {
          byUid: "hr-chico",
          byName: "Ms. Jean Ashley Chico",
          remarks: "Please specify the exact time of your faculty consultation and confirm whether your afternoon social media scheduling tasks are covered.",
          at: "2026-11-09T17:05:00+08:00",
          hrSignature: null
        },
        history: [
          {
            status: "submitted",
            byUid: "intern-juan",
            byName: "Juan Miguel Dela Cruz",
            remarks: "Submitted afternoon leave request.",
            at: "2026-11-09T14:00:00+08:00"
          },
          {
            status: "returned",
            byUid: "hr-chico",
            byName: "Ms. Jean Ashley Chico",
            remarks: "Please specify the exact time of your faculty consultation and confirm whether your afternoon social media scheduling tasks are covered.",
            at: "2026-11-09T17:05:00+08:00"
          }
        ],
        createdAt: "2026-11-09T13:55:00+08:00",
        submittedAt: "2026-11-09T14:00:00+08:00",
        updatedAt: "2026-11-09T17:05:00+08:00",
        templateVersion: "1.0"
      },

      "req-2026-005": {
        id: "req-2026-005",
        refNo: null,
        uid: "intern-sofia",
        snapshot: {
          name: "Sofia Gabrielle Reyes",
          internId: "APG-INT-2026-019",
          position: "Operations & Finance Intern",
          department: "Operations"
        },
        type: "full",
        date: "2026-11-20",
        startDate: null,
        endDate: null,
        days: 1,
        shift: null,
        timeRange: null,
        hoursImpact: 8,
        reasonCategory: "Family emergency",
        reasonDetails: "I need to accompany my grandmother for her scheduled diagnostic procedure at St. Luke's Medical Center as no other family member is available on that Friday.",
        attachment: null,
        internSignature: DEFAULT_SOFIA_SIG,
        status: "submitted",
        review: null,
        history: [
          {
            status: "submitted",
            byUid: "intern-sofia",
            byName: "Sofia Gabrielle Reyes",
            remarks: "Submitted full-day absence request.",
            at: "2026-11-10T10:30:00+08:00"
          }
        ],
        createdAt: "2026-11-10T10:25:00+08:00",
        submittedAt: "2026-11-10T10:30:00+08:00",
        updatedAt: "2026-11-10T10:30:00+08:00",
        templateVersion: "1.0"
      }
    },

    absenceSlots: {
      "intern-juan_2026-11-05_am": { requestId: "req-2026-001", uid: "intern-juan" },
      "intern-juan_2026-11-05_pm": { requestId: "req-2026-001", uid: "intern-juan" },
      "intern-sofia_2026-11-12_am": { requestId: "req-2026-002", uid: "intern-sofia" },
      "intern-juan_2026-11-18_am": { requestId: "req-2026-003", uid: "intern-juan" },
      "intern-juan_2026-11-18_pm": { requestId: "req-2026-003", uid: "intern-juan" },
      "intern-juan_2026-11-19_am": { requestId: "req-2026-003", uid: "intern-juan" },
      "intern-juan_2026-11-19_pm": { requestId: "req-2026-003", uid: "intern-juan" },
      "intern-sofia_2026-11-20_am": { requestId: "req-2026-005", uid: "intern-sofia" },
      "intern-sofia_2026-11-20_pm": { requestId: "req-2026-005", uid: "intern-sofia" }
    }
  };
}

let state = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not read state from localStorage", e);
  }
  const initial = getInitialSeedState();
  return initial;
}

function saveState(nextState) {
  if (nextState !== undefined) {
    state = nextState;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save state to localStorage", e);
  }
}

state = loadState();
saveState(state);

function resetDemoState() {
  localStorage.removeItem(STORAGE_KEY);
  state = getInitialSeedState();
  saveState(state);
  showToast("Demo database reset to initial Final v1.0 seed state.");
  renderApp();
}

/* ==========================================
   DATE, WEEKDAY & SLOT UTILITIES
   ========================================== */
function parseLocalDate(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLongDate(ymd) {
  const dt = parseLocalDate(ymd);
  if (!dt || isNaN(dt.getTime())) return "{DATE}";
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function formatStandardDate(ymd) {
  const dt = parseLocalDate(ymd);
  if (!dt || isNaN(dt.getTime())) return "{DATE}";
  return dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function formatShortDate(isoOrYmd) {
  if (!isoOrYmd) return "—";
  const dt = isoOrYmd.length === 10 ? parseLocalDate(isoOrYmd) : new Date(isoOrYmd);
  if (!dt || isNaN(dt.getTime())) return isoOrYmd;
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function countWeekdaysBetween(startYmd, endYmd) {
  const start = parseLocalDate(startYmd);
  const end = parseLocalDate(endYmd);
  if (!start || !end || end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function getWeekdayDatesList(startYmd, endYmd) {
  const start = parseLocalDate(startYmd);
  const end = parseLocalDate(endYmd);
  if (!start || !end || end < start) return [];
  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/**
 * Generates exact absenceSlot keys `{uid}_{yyyy-mm-dd}_{am|pm}` for a request
 */
function computeSlotKeysForRequest(uid, reqData) {
  const slots = [];
  if (reqData.type === "full" && reqData.date) {
    slots.push(`${uid}_${reqData.date}_am`, `${uid}_${reqData.date}_pm`);
  } else if (reqData.type === "half" && reqData.date) {
    const halfKey = reqData.shift === "afternoon" ? "pm" : "am";
    slots.push(`${uid}_${reqData.date}_${halfKey}`);
  } else if (reqData.type === "multi" && reqData.startDate && reqData.endDate) {
    const weekdays = getWeekdayDatesList(reqData.startDate, reqData.endDate);
    weekdays.forEach((d) => {
      slots.push(`${uid}_${d}_am`, `${uid}_${d}_pm`);
    });
  }
  return slots;
}

/**
 * Checks if any slot is already occupied by another active (submitted/approved) request
 */
function checkDuplicateSlots(uid, reqData, ignoreRequestId = null) {
  const keys = computeSlotKeysForRequest(uid, reqData);
  for (const key of keys) {
    const existing = state.absenceSlots[key];
    if (existing && existing.requestId !== ignoreRequestId) {
      const otherReq = state.requests[existing.requestId];
      if (otherReq && (otherReq.status === "submitted" || otherReq.status === "approved")) {
        const [, datePart, shiftPart] = key.split("_");
        return {
          conflict: true,
          date: datePart,
          shift: shiftPart.toUpperCase(),
          existingRequest: otherReq
        };
      }
    }
  }
  return { conflict: false };
}

/* ==========================================
   PURE FUNCTION: LOCKED LETTER RENDERER
   (Section 1 & Section 8 Step 3 of Final Plan)
   ========================================== */
function buildOpeningSentenceHTML(req, highlightVars = true) {
  const wrap = (val) =>
    highlightVars ? `<span class="a4-var-highlight">${escapeHtml(val)}</span>` : escapeHtml(val);

  const dutyPhrase = req.memberType === "employee" ? "work duties" : "internship duties";

  if (req.type === "half") {
    const shiftText = req.shift || "morning";
    const timeRangeText = req.timeRange || (shiftText === "morning" ? "8:00 AM – 12:00 PM" : "1:00 PM – 5:00 PM");
    const dateText = req.date ? formatLongDate(req.date) : "{DATE}";
    return `I respectfully request permission to be absent from my ${dutyPhrase} during the ${wrap(shiftText)} shift (${wrap(timeRangeText)}) of ${wrap(dateText)}.`;
  }

  if (req.type === "multi") {
    const startText = req.startDate ? formatLongDate(req.startDate) : "{START_DATE}";
    const endText = req.endDate ? formatLongDate(req.endDate) : "{END_DATE}";
    const nDays = req.startDate && req.endDate ? countWeekdaysBetween(req.startDate, req.endDate) : (req.days || "{N}");
    return `I respectfully request permission to be absent from my ${dutyPhrase} from ${wrap(startText)} to ${wrap(endText)} (${wrap(nDays + (nDays === 1 ? " day" : " days"))}).`;
  }

  // Default: Full-day
  const dateText = req.date ? formatLongDate(req.date) : "{DATE}";
  return `I respectfully request permission to be absent from my ${dutyPhrase} on ${wrap(dateText)}.`;
}

function renderLockedLetterHTML(req, letterSettings = state.settings.letter, options = {}) {
  const highlightVars = options.highlightVars !== false;
  const filingDateStr = formatStandardDate(
    (req.submittedAt || req.createdAt || "2026-11-10").slice(0, 10)
  );

  const snapshot = req.snapshot || {
    name: "Intern Name",
    internId: "APG-INT-XXXX",
    position: "Intern Position",
    department: "Department"
  };

  const openingHTML = buildOpeningSentenceHTML(req, highlightVars);
  const reasonBody = req.reasonDetails
    ? (highlightVars
        ? `<span class="a4-var-highlight">${escapeHtml(req.reasonDetails)}</span>`
        : escapeHtml(req.reasonDetails))
    : `<span class="a4-var-highlight" style="color:#94a3b8;">[I need to dedicate this day to completing and finalizing our feasibility study paper, which is a major academic requirement for our course. This task requires my full attention to ensure that the paper is completed and submitted on time.]</span>`;

  const isApproved = req.status === "approved";
  const hrSigToRender = isApproved && req.review && req.review.hrSignature
    ? req.review.hrSignature
    : null;

  let topStampHTML = "";
  if (isApproved) {
    const approvedDate = req.review && req.review.at ? formatShortDate(req.review.at) : filingDateStr;
    topStampHTML = `
      <div class="a4-approval-stamp">
        <div class="a4-approval-stamp-title">✓ APPROVED</div>
        <div class="a4-approval-stamp-ref">REF: ${escapeHtml(req.refNo || "APG-EL-2026-XXXX")}</div>
        <div class="a4-approval-stamp-date">Date: ${escapeHtml(approvedDate)}</div>
      </div>
    `;
  } else if (req.status && req.status !== "draft") {
    topStampHTML = `
      <div class="a4-status-watermark">
        STATUS: ${escapeHtml(req.status.toUpperCase())}
      </div>
    `;
  }

  return `
    <div class="a4-sheet ${options.cleanPdf ? "clean-pdf-render" : ""}" id="${options.elementId || "a4-letter-preview"}">
      ${topStampHTML}

      <!-- Locked A4 Letter Content overlaying the Official Letterhead Template -->
      <div class="a4-letter-content">
        <!-- Top Row: Address Block Left, Date Right -->
        <div class="a4-meta-row">
          <div class="a4-address-text">${escapeHtml(letterSettings.addressBlock)}</div>
          <div class="a4-date-text">Date: ${escapeHtml(filingDateStr)}</div>
        </div>

        <!-- Subject Line -->
        <div class="a4-subject-line">SUBJECT: ${escapeHtml(letterSettings.subject)}</div>

        <!-- Salutation -->
        <div class="a4-salutation-line">${escapeHtml(letterSettings.salutation || "Good day, Ma'am!")}</div>

        <!-- 1st Paragraph: Opening Permission Request -->
        <p class="a4-body-p">${openingHTML}</p>

        <!-- 2nd Paragraph: Reason Details -->
        <p class="a4-body-p">${reasonBody}</p>

        <!-- 3rd Paragraph: Apology & Handover Assurance -->
        <p class="a4-body-p">${escapeHtml(letterSettings.apologyParagraph)}</p>

        <!-- 4th Paragraph: Closing Appreciation -->
        <p class="a4-body-p">${escapeHtml(letterSettings.thankYouParagraph)}</p>

        <!-- Dual Signature Section Matching Exact Template Layout -->
        <div class="a4-signatures-row">
          <!-- Intern Signature Column (Left) -->
          <div class="a4-sig-col">
            <div class="a4-sig-greeting">Sincerely,</div>
            <div class="a4-sig-space">
              ${
                req.internSignature
                  ? `<img src="${req.internSignature}" alt="Intern Signature" />`
                  : `<span class="a4-sig-space-placeholder">[Intern signature required]</span>`
              }
            </div>
            <div class="a4-person-name">${escapeHtml(snapshot.name)}</div>
            <div class="a4-person-title">${escapeHtml(snapshot.position)}</div>
          </div>

          <!-- HR Signatory Column (Right) -->
          <div class="a4-sig-col">
            <div class="a4-sig-space">
              ${
                hrSigToRender
                  ? `<img src="${hrSigToRender}" alt="HR Officer Signature" />`
                  : `<span class="a4-sig-space-placeholder">${isApproved ? "" : "[Stamped automatically upon HR Approval]"}</span>`
              }
            </div>
            <div class="a4-person-name">${escapeHtml(letterSettings.signatoryName)}</div>
            <div class="a4-person-title">${escapeHtml(letterSettings.signatoryTitle)}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================
   CLIENT-SIDE A4 PDF GENERATOR
   (html2canvas + jsPDF over A4 sheet)
   ========================================== */
async function downloadRequestPDF(requestId) {
  const req = state.requests[requestId];
  if (!req) return;

  showToast("Generating official A4 PDF document...");

  // Create offscreen clean A4 container for crisp capture
  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  holder.style.top = "0";
  holder.innerHTML = renderLockedLetterHTML(req, state.settings.letter, {
    highlightVars: false,
    cleanPdf: true,
    elementId: "pdf-export-sheet"
  });
  document.body.appendChild(holder);

  const sheetEl = holder.querySelector("#pdf-export-sheet");

  try {
    if (window.html2canvas && window.jspdf) {
      const canvas = await window.html2canvas(sheetEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
      });
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      const fileName = `${req.refNo || req.id}_${req.snapshot.name.replace(/\s+/g, "_")}.pdf`;
      pdf.save(fileName);
      showToast(`Downloaded ${fileName}`);
    } else {
      window.print();
    }
  } catch (err) {
    console.error("PDF export error, falling back to print:", err);
    window.print();
  } finally {
    document.body.removeChild(holder);
  }
}

/* ==========================================
   HELPERS & UI UTILITIES
   ========================================== */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3600);
}

function renderStatusPill(status) {
  const labels = {
    draft: "📝 Draft",
    submitted: "🟡 Submitted",
    approved: "🟢 Approved",
    declined: "🔴 Declined",
    returned: "🟠 Returned for revision",
    withdrawn: "⚪ Withdrawn"
  };
  return `<span class="status-pill status-${escapeHtml(status)}">${labels[status] || escapeHtml(status)}</span>`;
}

function getCurrentUser() {
  return state.users[state.currentUserUid] || null;
}

function computeInternHoursStats(uid) {
  const user = state.users[uid];
  if (!user) return { required: 480, rendered: 0, approvedDeducted: 0, pendingDeducted: 0, remaining: 480 };

  const userReqs = Object.values(state.requests).filter((r) => r.uid === uid);
  const approvedDeducted = userReqs
    .filter((r) => r.status === "approved")
    .reduce((acc, r) => acc + (Number(r.hoursImpact) || 0), 0);

  const pendingDeducted = userReqs
    .filter((r) => r.status === "submitted")
    .reduce((acc, r) => acc + (Number(r.hoursImpact) || 0), 0);

  // Decision 8: Only Approved requests deduct hours ( effectively adding to remaining hours needed or deducting from effective rendered credit )
  const effectiveRendered = Math.max(0, (Number(user.renderedHours) || 0) - approvedDeducted);
  const remaining = Math.max(0, (Number(user.requiredHours) || 480) - effectiveRendered);

  return {
    required: Number(user.requiredHours) || 480,
    rendered: Number(user.renderedHours) || 0,
    approvedDeducted,
    pendingDeducted,
    effectiveRendered,
    remaining
  };
}

/* ==========================================
   ROLE / DEMO SWITCHER & NAVIGATION
   ========================================== */
function switchDemoAccount(uidOrAuth) {
  if (uidOrAuth === "auth-screen") {
    state.currentUserUid = null;
    state.currentScreen = "login";
  } else {
    state.currentUserUid = uidOrAuth;
    const u = state.users[uidOrAuth];
    if (u.role === "hr") {
      state.currentScreen = "hr-queue";
    } else {
      state.currentScreen = "intern-dashboard";
    }
  }
  state.editingRequestId = null;
  saveState();
  renderApp();
}

function navigateTo(screen, opts = {}) {
  state.currentScreen = screen;
  if (opts.editRequestId !== undefined) {
    state.editingRequestId = opts.editRequestId;
  }
  if (opts.reviewRequestId !== undefined) {
    state.selectedRequestIdForReview = opts.reviewRequestId;
  }
  saveState();
  renderApp();
}

function getUserInitials(name) {
  if (!name) return "AP";
  const clean = name.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, "").trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  saveState();
  renderApp();
}

/* ==========================================
   MAIN RENDER FUNCTION
   ========================================== */
function renderApp() {
  const root = document.getElementById("app-root");
  if (!root) return;

  const currentUser = getCurrentUser();
  const pendingCountForHR = Object.values(state.requests).filter((r) => r.status === "submitted").length;
  const pendingAccountsCount = Object.values(state.users).filter((u) => u.role === "intern" && u.status === "pending").length;
  const returnedCountForIntern = currentUser
    ? Object.values(state.requests).filter((r) => r.uid === currentUser.uid && r.status === "returned").length
    : 0;

  // Top Demo / Role Switcher Bar
  const demoBarHTML = `
    <div class="demo-bar no-print">
      <div class="demo-bar-left">
        <span class="demo-badge">Final v1.0 Prototype</span>
        <span>Switch Persona / Screen:</span>
        <button class="demo-switcher-btn ${state.currentUserUid === "intern-juan" ? "active" : ""}" onclick="switchDemoAccount('intern-juan')">
          👨‍💼 Intern: Juan Dela Cruz (Active)
        </button>
        <button class="demo-switcher-btn ${state.currentUserUid === "intern-sofia" ? "active" : ""}" onclick="switchDemoAccount('intern-sofia')">
          👩‍💼 Intern: Sofia Reyes (Active)
        </button>
        <button class="demo-switcher-btn ${state.currentUserUid === "emp-carlos" ? "active" : ""}" onclick="switchDemoAccount('emp-carlos')">
          👔 Employee: Carlos Mendoza (Active)
        </button>
        <button class="demo-switcher-btn ${state.currentUserUid === "intern-maria" ? "active" : ""}" onclick="switchDemoAccount('intern-maria')">
          ⏳ Intern: Maria Santos (Pending Activation)
        </button>
        <button class="demo-switcher-btn ${state.currentUserUid === "hr-chico" ? "active" : ""}" onclick="switchDemoAccount('hr-chico')">
          🛡️ HR Officer: Ms. Jean Ashley Chico (${pendingCountForHR} Pending)
        </button>
        <button class="demo-switcher-btn ${!state.currentUserUid ? "active" : ""}" onclick="switchDemoAccount('auth-screen')">
          🔐 Screen 1: Login / Register
        </button>
      </div>
      <div>
        <button class="demo-switcher-btn" onclick="resetDemoState()">↺ Reset Seed Data</button>
      </div>
    </div>
  `;

  // If on Login / Register screen
  if (!currentUser || state.currentScreen === "login") {
    root.innerHTML = demoBarHTML + renderLoginScreen();
    return;
  }

  // Sidebar Items based on Role
  let navItemsHTML = "";
  if (currentUser.role === "intern" || currentUser.role === "employee") {
    navItemsHTML = `
      <div class="nav-section-label">${currentUser.role === "employee" ? "Employee Portal" : "Intern Portal"}</div>
      <ul class="nav-list">
        <li class="nav-item ${state.currentScreen === "intern-dashboard" ? "active" : ""}" onclick="navigateTo('intern-dashboard')" title="Dashboard & Hours">
          <div class="nav-item-content">
            <span class="nav-icon">📊</span>
            <span class="nav-label">Dashboard & Hours</span>
          </div>
        </li>
        <li class="nav-item ${state.currentScreen === "new-request" ? "active" : ""}" onclick="navigateTo('new-request', { editRequestId: null })" title="New Absence Request">
          <div class="nav-item-content">
            <span class="nav-icon">✍️</span>
            <span class="nav-label">New Absence Request</span>
          </div>
        </li>
        <li class="nav-item ${state.currentScreen === "my-requests" ? "active" : ""}" onclick="navigateTo('my-requests')" title="My Requests">
          <div class="nav-item-content">
            <span class="nav-icon">📁</span>
            <span class="nav-label">My Requests</span>
          </div>
          ${returnedCountForIntern > 0 ? `<span class="nav-badge" title="${returnedCountForIntern} requests to revise">${returnedCountForIntern}</span>` : ""}
        </li>
      </ul>
    `;
  } else {
    navItemsHTML = `
      <div class="nav-section-label">HR Administration</div>
      <ul class="nav-list">
        <li class="nav-item ${state.currentScreen === "hr-queue" ? "active" : ""}" onclick="navigateTo('hr-queue')" title="HR Review Queue">
          <div class="nav-item-content">
            <span class="nav-icon">📥</span>
            <span class="nav-label">Review Queue</span>
          </div>
          ${pendingCountForHR > 0 ? `<span class="nav-badge" title="${pendingCountForHR} pending">${pendingCountForHR}</span>` : ""}
        </li>
        <li class="nav-item ${state.currentScreen === "hr-review" ? "active" : ""}" onclick="navigateTo('hr-review')" title="Review Letter Screen">
          <div class="nav-item-content">
            <span class="nav-icon">🔍</span>
            <span class="nav-label">Review Letter</span>
          </div>
        </li>
        <li class="nav-item ${state.currentScreen === "hr-calendar" ? "active" : ""}" onclick="navigateTo('hr-calendar')" title="Attendance Calendar">
          <div class="nav-item-content">
            <span class="nav-icon">📅</span>
            <span class="nav-label">Calendar</span>
          </div>
        </li>
        <li class="nav-item ${state.currentScreen === "hr-settings" ? "active" : ""}" onclick="navigateTo('hr-settings')" title="HR Settings & Accounts">
          <div class="nav-item-content">
            <span class="nav-icon">⚙️</span>
            <span class="nav-label">Settings & Accounts</span>
          </div>
          ${pendingAccountsCount > 0 ? `<span class="nav-badge" title="${pendingAccountsCount} new accounts">${pendingAccountsCount}</span>` : ""}
        </li>
      </ul>
    `;
  }

  let mainViewHTML = "";
  if (currentUser.role === "intern" && currentUser.status === "pending") {
    mainViewHTML = renderPendingInternScreen(currentUser);
  } else {
    switch (state.currentScreen) {
      case "intern-dashboard":
        mainViewHTML = renderInternDashboard(currentUser);
        break;
      case "new-request":
        mainViewHTML = renderNewRequestScreen(currentUser);
        break;
      case "my-requests":
        mainViewHTML = renderMyRequestsScreen(currentUser);
        break;
      case "hr-queue":
        mainViewHTML = renderHRQueueScreen();
        break;
      case "hr-review":
        mainViewHTML = renderHRReviewScreen();
        break;
      case "hr-calendar":
        mainViewHTML = renderHRCalendarScreen();
        break;
      case "hr-settings":
        mainViewHTML = renderHRSettingsScreen();
        break;
      default:
        mainViewHTML = currentUser.role === "hr" ? renderHRQueueScreen() : renderInternDashboard(currentUser);
    }
  }

  root.innerHTML = `
    ${demoBarHTML}
    <div class="app-shell">
      <aside class="sidebar no-print ${state.sidebarCollapsed ? "collapsed" : ""}">
        <div class="brand-box">
          <div class="brand-left">
            <div class="brand-emblem">AP</div>
            <div class="brand-title-wrap">
              <div class="brand-title">ALPHA PREMIER</div>
              <div class="brand-subtitle">Absence System v1.0</div>
            </div>
          </div>
          <button class="sidebar-toggle-btn" onclick="toggleSidebar()" title="${state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}">
            ${state.sidebarCollapsed ? "❯" : "❮"}
          </button>
        </div>

        <div class="user-card">
          <div class="user-card-compact" title="${escapeHtml(currentUser.name)} (${escapeHtml(currentUser.position || "")})">
            <div class="user-avatar-circle">${getUserInitials(currentUser.name)}</div>
          </div>
          <div class="user-card-details">
            <div class="user-card-name">${escapeHtml(currentUser.name)}</div>
            <div class="user-card-meta">${escapeHtml(currentUser.position || "Unassigned Position")}</div>
            <div class="user-card-meta">${escapeHtml(currentUser.internId || "Pending ID")}</div>
            <span class="user-role-tag">${currentUser.role === "hr" ? "HR Officer" : (currentUser.role === "employee" ? "Employee" : `Intern (${currentUser.status})`)}</span>
          </div>
        </div>

        ${navItemsHTML}

        <div class="sidebar-footer">
          <div>Locked Template v${escapeHtml(state.settings.letter.templateVersion)}</div>
          <div style="margin-top:4px;">Signatory: ${escapeHtml(state.settings.letter.signatoryName)}</div>
        </div>
      </aside>

      <main class="main-content">
        ${mainViewHTML}
      </main>
    </div>
    <div id="modal-root"></div>
  `;

  // Post-render hooks (signature pad canvas, live preview bindings)
  if (state.currentScreen === "new-request" && currentUser.status === "active") {
    initNewRequestInteractivity();
  }
  if (state.currentScreen === "hr-settings") {
    initHRSettingsSignatureCanvas();
  }
}

/* ==========================================
   SCREEN 1: LOGIN & SELF-REGISTRATION
   (Decision 6: Self-registered interns start as `pending`)
   ========================================== */
function renderLoginScreen() {
  return `
    <div style="min-height: calc(100vh - 42px); display:flex; align-items:center; justify-content:center; padding:24px; background:linear-gradient(135deg, #0c2340 0%, #1e3a8a 100%);">
      <div class="card" style="max-width:920px; width:100%; margin:0; display:grid; grid-template-columns:1fr 1fr; overflow:hidden; box-shadow:var(--shadow-lg);">
        <!-- Left: Sign In -->
        <div style="padding:32px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
            <div class="brand-emblem">AP</div>
            <div>
              <div style="font-weight:800; color:var(--apg-navy); font-size:16px;">ALPHA PREMIER GROUP</div>
              <div style="font-size:12px; color:var(--text-muted);">Leave of Absence Portal</div>
            </div>
          </div>

          <h2 style="font-size:20px; color:var(--apg-navy); margin-bottom:6px;">Sign In</h2>
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:18px;">
            Select an account below or sign in with your registered email.
          </p>

          <form onsubmit="handleLoginSubmit(event)">
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="login-email" class="form-control" value="juan.delacruz@university.edu.ph" required />
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" class="form-control" value="••••••••••••" required />
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">Sign In with Firebase Auth</button>
          </form>

          <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border);">
            <div style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">QUICK DEMO ACCOUNTS:</div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <button class="btn btn-outline btn-sm" onclick="switchDemoAccount('intern-juan')">Intern: Juan Dela Cruz (Active · 480h)</button>
              <button class="btn btn-outline btn-sm" onclick="switchDemoAccount('hr-chico')">HR Officer: Ms. Jean Ashley Chico</button>
            </div>
          </div>
        </div>

        <!-- Right: Intern Self-Registration -->
        <div style="padding:32px; background:#f8fafc; border-left:1px solid var(--border);">
          <h2 style="font-size:20px; color:var(--apg-navy); margin-bottom:6px;">Intern Self-Registration</h2>
          <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:16px;">
            <strong>Decision #6 Security Policy:</strong> New intern accounts start as <span class="status-pill status-submitted">pending</span>. HR activates your profile and sets your official Intern ID, Position, Department, and Required Hours so letter variables are never mistyped.
          </p>

          <form onsubmit="handleSelfRegisterSubmit(event)">
            <div class="form-group">
              <label class="form-label">Full Name (for Official Letterhead)</label>
              <input type="text" id="reg-name" class="form-control" placeholder="e.g., Carlos Miguel Villanueva" required />
            </div>
            <div class="form-group">
              <label class="form-label">University / Personal Email</label>
              <input type="email" id="reg-email" class="form-control" placeholder="carlos.villanueva@university.edu.ph" required />
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="reg-pass" class="form-control" placeholder="Minimum 8 characters" required />
            </div>
            <button type="submit" class="btn btn-gold" style="width:100%;">Register Intern Account</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const found = Object.values(state.users).find((u) => u.email.toLowerCase() === email);
  if (found) {
    switchDemoAccount(found.uid);
    showToast(`Signed in as ${found.name}`);
  } else {
    showToast("No user found with that email. Try registering or clicking a Quick Demo Account.");
  }
}

function handleSelfRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  if (!name || !email) return;

  const uid = "intern-" + Date.now();
  state.users[uid] = {
    uid,
    name,
    email,
    internId: "",
    position: "",
    department: "",
    role: "intern",
    status: "pending",
    requiredHours: 480,
    renderedHours: 0,
    savedSignature: "",
    createdAt: new Date().toISOString()
  };
  state.currentUserUid = uid;
  state.currentScreen = "intern-dashboard";
  saveState();
  showToast("Account created with status: PENDING. HR must activate your profile.");
  renderApp();
}

function renderPendingInternScreen(user) {
  return `
    <div class="card" style="max-width:680px; margin:40px auto; text-align:center; padding:36px;">
      <div style="font-size:44px; margin-bottom:12px;">⏳</div>
      <h2 class="page-title">Account Pending HR Activation</h2>
      <p style="color:var(--text-muted); margin:12px 0 20px; font-size:14.5px;">
        Welcome, <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}).<br/>
        To ensure every official Alpha Premier letter uses standardized titles and IDs (preventing typos like <em>"MarketingAssociate"</em>), HR must activate your account and assign your <strong>ID Number</strong>, <strong>Official Position</strong>, <strong>Department</strong>, and <strong>Required / Target Hours</strong> before you can file absence requests.
      </p>
      <div style="background:#f8fafc; border:1px solid var(--border); padding:16px; border-radius:8px; text-align:left; font-size:13px; margin-bottom:20px;">
        <div><strong>Current Status:</strong> <span class="status-pill status-submitted">Pending HR Activation</span></div>
        <div style="margin-top:6px;"><strong>Tip for testing:</strong> Click <strong>"🛡️ HR Officer: Ms. Jean Ashley Chico"</strong> in the top bar → go to <strong>HR Settings & Accounts</strong> → click <strong>Activate & Assign Profile</strong> next to ${escapeHtml(user.name)}!</div>
      </div>
      <button class="btn btn-primary" onclick="switchDemoAccount('hr-chico'); navigateTo('hr-settings');">
        Switch to HR Officer to Activate This Account →
      </button>
    </div>
  `;
}

/* ==========================================
   SCREEN 2: INTERN DASHBOARD
   ========================================== */
function renderInternDashboard(user) {
  const hrs = computeInternHoursStats(user.uid);
  const myReqs = Object.values(state.requests)
    .filter((r) => r.uid === user.uid)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  const counts = {
    approved: myReqs.filter((r) => r.status === "approved").length,
    submitted: myReqs.filter((r) => r.status === "submitted").length,
    returned: myReqs.filter((r) => r.status === "returned").length,
    draft: myReqs.filter((r) => r.status === "draft").length
  };

  const pctRendered = Math.min(100, Math.round((hrs.effectiveRendered / hrs.required) * 100));
  const pctDeducted = Math.min(100 - pctRendered, Math.round((hrs.approvedDeducted / hrs.required) * 100));
  const pctPending = Math.min(100 - pctRendered - pctDeducted, Math.round((hrs.pendingDeducted / hrs.required) * 100));

  const returnedAlertHTML = counts.returned > 0
    ? `
      <div class="card" style="border-left:5px solid #ea580c; background:#fff7ed;">
        <div class="card-body" style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
          <div>
            <div style="font-weight:700; color:#9a3412; font-size:14.5px;">🟠 You have ${counts.returned} request returned for revision by HR</div>
            <div style="font-size:13px; color:#7c2d12; margin-top:2px;">You can edit the remarks/details and resubmit without filing a brand-new request.</div>
          </div>
          <button class="btn btn-warning btn-sm" onclick="navigateTo('my-requests')">Review & Revise →</button>
        </div>
      </div>
    `
    : "";

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">${user.role === "employee" ? "Employee Dashboard" : "Dashboard"}</h1>
        <p class="page-subtitle">Locked Profile Snapshot: <strong>${escapeHtml(user.name)}</strong> · ${escapeHtml(user.position)} · ID: <code>${escapeHtml(user.internId)}</code></p>
      </div>
      <button class="btn btn-primary" onclick="navigateTo('new-request', { editRequestId: null })">
        + New Leave of Absence Request
      </button>
    </div>

    ${returnedAlertHTML}

    <!-- Hours Impact Card -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">⏱️ Hours Tracker & Absence Deduction Impact</span>
        <span style="font-size:12px; color:var(--text-muted);">Rule: Full-day = 8h · Half-day = 4h · Multi-day = 8h × weekdays (Approved only deducts)</span>
      </div>
      <div class="card-body">
        <div class="stats-grid" style="margin-bottom:14px;">
          <div class="stat-card">
            <div class="stat-label">${user.role === "employee" ? "Target Work Hours" : "Required Hours"}</div>
            <div class="stat-value">${hrs.required} h</div>
            <div class="stat-sub">Set by HR upon activation</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Gross Rendered Hours</div>
            <div class="stat-value" style="color:#15803d;">${hrs.rendered} h</div>
            <div class="stat-sub">Logged attendance hours</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Approved Absence Deduction</div>
            <div class="stat-value" style="color:#dc2626;">-${hrs.approvedDeducted} h</div>
            <div class="stat-sub">${hrs.pendingDeducted > 0 ? `+ ${hrs.pendingDeducted} h pending review` : "No pending deductions"}</div>
          </div>
          <div class="stat-card" style="background:#f8fafc; border-color:var(--apg-navy);">
            <div class="stat-label">Net Remaining Hours Needed</div>
            <div class="stat-value" style="color:var(--apg-navy);">${hrs.remaining} h</div>
            <div class="stat-sub">Net credited: ${hrs.effectiveRendered} / ${hrs.required} h (${pctRendered}%)</div>
          </div>
        </div>

        <div class="hours-meter">
          <div class="hours-bar-rendered" style="width:${pctRendered}%" title="Net Credited Hours"></div>
          <div class="hours-bar-deducted" style="width:${pctDeducted}%" title="Approved Absence Deduction"></div>
          <div class="hours-bar-pending" style="width:${pctPending}%" title="Pending Absence Deduction"></div>
        </div>
        <div style="display:flex; gap:18px; font-size:12px; color:var(--text-muted); flex-wrap:wrap;">
          <span>🟢 Net Credited (${hrs.effectiveRendered}h)</span>
          <span>🔴 Deducted by Approved Leave (-${hrs.approvedDeducted}h)</span>
          <span>🟡 Pending Review Impact (${hrs.pendingDeducted}h)</span>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Request Summary -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 Recent Absence Requests</span>
          <button class="btn btn-outline btn-sm" onclick="navigateTo('my-requests')">View All (${myReqs.length})</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date(s)</th>
                <th>Type / Hours</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${myReqs
                .slice(0, 5)
                .map(
                  (r) => `
                <tr class="${r.status === "withdrawn" ? "row-withdrawn" : ""}">
                  <td>
                    <div style="font-weight:600;">${
                      r.type === "multi"
                        ? `${formatShortDate(r.startDate)} – ${formatShortDate(r.endDate)}`
                        : formatShortDate(r.date)
                    }</div>
                    <div style="font-size:11.5px; color:var(--text-light);">${escapeHtml(r.reasonCategory)}</div>
                  </td>
                  <td>
                    <span style="text-transform:capitalize; font-weight:600;">${escapeHtml(r.type)}</span>
                    <div style="font-size:11.5px; color:var(--text-muted);">-${r.hoursImpact} hrs</div>
                  </td>
                  <td>${renderStatusPill(r.status)}</td>
                  <td>
                    <button class="btn btn-outline btn-sm" onclick="openLetterModal('${r.id}')">Preview</button>
                    ${
                      r.status === "returned" || r.status === "draft"
                        ? `<button class="btn btn-warning btn-sm" onclick="navigateTo('new-request', { editRequestId: '${r.id}' })">Revise</button>`
                        : ""
                    }
                    ${
                      r.status === "approved"
                        ? `<button class="btn btn-primary btn-sm" onclick="downloadRequestPDF('${r.id}')">PDF</button>`
                        : ""
                    }
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Saved Profile & Reusable Signature -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">✒️ Locked Profile & Saved Signature</span>
        </div>
        <div class="card-body">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px; margin-bottom:16px;">
            <div>
              <div style="color:var(--text-light); font-size:11.5px;">FULL NAME</div>
              <div style="font-weight:700;">${escapeHtml(user.name)}</div>
            </div>
            <div>
              <div style="color:var(--text-light); font-size:11.5px;">ID NUMBER (HR LOCKED)</div>
              <div style="font-weight:700;">${escapeHtml(user.internId)}</div>
            </div>
            <div>
              <div style="color:var(--text-light); font-size:11.5px;">OFFICIAL POSITION (HR LOCKED)</div>
              <div style="font-weight:700;">${escapeHtml(user.position)}</div>
            </div>
            <div>
              <div style="color:var(--text-light); font-size:11.5px;">DEPARTMENT (HR LOCKED)</div>
              <div style="font-weight:700;">${escapeHtml(user.department)}</div>
            </div>
          </div>

          <div style="border-top:1px solid var(--border); padding-top:14px;">
            <div style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">SAVED SIGNATURE ON PROFILE (REUSABLE ON LETTERS):</div>
            <div style="border:1px dashed var(--border-strong); border-radius:8px; padding:12px; background:#fafafa; display:flex; align-items:center; justify-content:space-between;">
              ${
                user.savedSignature
                  ? `<img src="${user.savedSignature}" alt="Saved Signature" style="max-height:54px;" />`
                  : `<span style="color:var(--text-light); font-size:12.5px;">No signature saved yet.</span>`
              }
              <button class="btn btn-outline btn-sm" onclick="navigateTo('new-request')">Update in Form</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================
   SCREEN 3: NEW / REVISE REQUEST
   (Split Screen: Form Left, Live Locked A4 Preview Right)
   ========================================== */
function renderNewRequestScreen(user) {
  const editingReq = state.editingRequestId ? state.requests[state.editingRequestId] : null;
  const isRevise = Boolean(editingReq);

  const initialData = editingReq || {
    type: "full",
    date: "2026-11-16",
    startDate: "2026-11-16",
    endDate: "2026-11-17",
    shift: "morning",
    timeRange: "8:00 AM – 12:00 PM",
    reasonCategory: "Academic",
    reasonDetails: "I have a scheduled consultation with my Capstone Research Adviser at the university campus to finalize our manuscript revisions prior to binding.",
    internSignature: user.savedSignature || "",
    status: "draft"
  };

  // Minimum date allowed: 7 days back from current system date (2026-11-10 -> 2026-11-03)
  const minDateAllowed = "2026-11-03";

  const hrRemarksBanner =
    editingReq && editingReq.status === "returned" && editingReq.review
      ? `
      <div class="card" style="border-left:5px solid #ea580c; background:#fff7ed; margin-bottom:18px;">
        <div class="card-body">
          <div style="font-weight:700; color:#9a3412;">🟠 Returned for Revision by ${escapeHtml(editingReq.review.byName)}</div>
          <div style="font-size:13.5px; color:#7c2d12; margin-top:4px;"><strong>HR Remarks:</strong> "${escapeHtml(editingReq.review.remarks)}"</div>
        </div>
      </div>
    `
      : "";

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">${isRevise ? `Revise Request (${editingReq.id})` : "New Leave of Absence Request"}</h1>
        <p class="page-subtitle">Fill in the variables below. The locked Alpha Premier letter updates in real time on the right.</p>
      </div>
      <button class="btn btn-outline" onclick="navigateTo('my-requests')">← Back to My Requests</button>
    </div>

    ${hrRemarksBanner}

    <div class="split-workspace">
      <!-- LEFT COLUMN: VARIABLE INPUT FORM -->
      <div class="card" style="margin-bottom:0;">
        <div class="card-header">
          <span class="card-title">1. Absence Variables</span>
          <span style="font-size:11.5px; color:var(--text-muted);">All wording & layout locked by HR</span>
        </div>
        <div class="card-body">
          <!-- Locked Auto-Filled Profile Snapshot Preview -->
          <div style="background:#f8fafc; border:1px solid var(--border); border-radius:7px; padding:10px 12px; margin-bottom:16px; font-size:12px;">
            <div style="font-weight:700; color:var(--apg-navy); margin-bottom:3px;">🔒 Auto-Snapshotted from Profile:</div>
            <div><strong>${escapeHtml(user.name)}</strong> · ${escapeHtml(user.position)} · <code>${escapeHtml(user.internId)}</code></div>
          </div>

          <!-- Role / Member Type Dropdown (Intern or Employee) -->
          <div class="form-group">
            <label class="form-label">
              <span>Member Type *</span>
              <span style="font-weight:400; font-size:11.5px; color:var(--text-light);">Select whether filing as Intern or Employee</span>
            </label>
            <select id="f-member-type" class="form-control" onchange="updateLiveLetterPreview()">
              <option value="intern" ${initialData.memberType === "intern" || (!initialData.memberType && user.role !== "employee") ? "selected" : ""}>Intern</option>
              <option value="employee" ${initialData.memberType === "employee" || user.role === "employee" ? "selected" : ""}>Employee</option>
            </select>
          </div>

          <!-- Absence Type -->
          <div class="form-group">
            <label class="form-label">Absence Type *</label>
            <div class="radio-pills" id="type-pills">
              <div class="radio-pill ${initialData.type === "full" ? "active" : ""}" data-type="full" onclick="setFormAbsenceType('full')">Full-day (8h)</div>
              <div class="radio-pill ${initialData.type === "half" ? "active" : ""}" data-type="half" onclick="setFormAbsenceType('half')">Half-day (4h)</div>
              <div class="radio-pill ${initialData.type === "multi" ? "active" : ""}" data-type="multi" onclick="setFormAbsenceType('multi')">Multiple days</div>
            </div>
            <input type="hidden" id="f-type" value="${escapeHtml(initialData.type)}" />
          </div>

          <!-- Single Date Picker (Full or Half) -->
          <div class="form-group" id="single-date-group" style="${initialData.type === "multi" ? "display:none;" : ""}">
            <label class="form-label">
              <span>Date of Absence *</span>
              <span style="font-weight:400; font-size:11.5px; color:var(--text-light);">Min: ${minDateAllowed} (7 days back max)</span>
            </label>
            <input type="date" id="f-date" class="form-control" min="${minDateAllowed}" value="${escapeHtml(initialData.date || "2026-11-16")}" />
          </div>

          <!-- Multi-Day Range Picker -->
          <div id="multi-date-group" style="${initialData.type === "multi" ? "" : "display:none;"}">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;" class="form-group">
              <div>
                <label class="form-label">Start Date *</label>
                <input type="date" id="f-start-date" class="form-control" min="${minDateAllowed}" value="${escapeHtml(initialData.startDate || "2026-11-16")}" />
              </div>
              <div>
                <label class="form-label">End Date *</label>
                <input type="date" id="f-end-date" class="form-control" min="${minDateAllowed}" value="${escapeHtml(initialData.endDate || "2026-11-17")}" />
              </div>
            </div>
            <div class="form-hint" id="multi-days-hint" style="margin-top:-8px; margin-bottom:14px; font-weight:600; color:var(--apg-navy);">
              Weekdays (Mon–Fri) counted: 2 days (16 hours impact)
            </div>
          </div>

          <!-- Half-Day Shift & Time Range -->
          <div id="half-shift-group" style="${initialData.type === "half" ? "" : "display:none;"}">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;" class="form-group">
              <div>
                <label class="form-label">Half-Day Shift *</label>
                <select id="f-shift" class="form-control">
                  <option value="morning" ${initialData.shift === "morning" ? "selected" : ""}>Morning</option>
                  <option value="afternoon" ${initialData.shift === "afternoon" ? "selected" : ""}>Afternoon</option>
                </select>
              </div>
              <div>
                <label class="form-label">Time Range *</label>
                <input type="text" id="f-timerange" class="form-control" value="${escapeHtml(initialData.timeRange || "8:00 AM – 12:00 PM")}" placeholder="8:00 AM – 12:00 PM" />
              </div>
            </div>
          </div>

          <!-- Duplicate Slot Guard Live Banner -->
          <div id="duplicate-guard-alert" style="display:none; background:#fee2e2; border:1px solid #f87171; color:#991b1b; padding:10px 12px; border-radius:7px; font-size:12.5px; margin-bottom:16px; font-weight:600;"></div>

          <!-- Reason Category (HR Filtering & Analytics) -->
          <div class="form-group">
            <label class="form-label">
              <span>Reason Category *</span>
              <span style="font-weight:400; font-size:11.5px; color:var(--text-light);">For HR filtering & analytics (not printed)</span>
            </label>
            <select id="f-category" class="form-control">
              ${["Academic", "Medical", "Family emergency", "School activity", "Personal", "Other"]
                .map((cat) => `<option value="${cat}" ${initialData.reasonCategory === cat ? "selected" : ""}>${cat}</option>`)
                .join("")}
            </select>
          </div>

          <!-- Reason Details (30-400 characters) -->
          <div class="form-group">
            <label class="form-label">
              <span>Reason Details (2nd Paragraph) *</span>
              <span id="char-counter" style="font-size:12px; font-weight:700;">0 / 400 chars (min 30)</span>
            </label>
            <textarea id="f-details" class="form-control" rows="4" maxlength="400" placeholder="State the specific reason for your absence (30 to 400 characters so the letter stays strictly one A4 page)...">${escapeHtml(initialData.reasonDetails || "")}</textarea>
          </div>

          <!-- Optional Attachment (Feature-Flagged by settings/letter.attachmentsEnabled) -->
          ${
            state.settings.letter.attachmentsEnabled
              ? `
            <div class="form-group">
              <label class="form-label">
                <span>Supporting Attachment (Optional)</span>
                <span style="font-weight:400; font-size:11.5px; color:var(--text-light);">PDF/JPG/PNG ≤ 5 MB (Linked, not printed)</span>
              </label>
              <input type="file" id="f-attachment" class="form-control" accept=".pdf,.jpg,.jpeg,.png" />
            </div>
          `
              : `
            <div style="background:#f8fafc; border:1px dashed var(--border-strong); padding:8px 12px; border-radius:6px; font-size:11.5px; color:var(--text-light); margin-bottom:16px;">
              📎 <strong>Attachments:</strong> Hidden while <code>settings/letter.attachmentsEnabled</code> is <code>false</code> (Decision #4). HR can toggle this flag on in <strong>HR Settings</strong>.
            </div>
          `
          }

          <!-- Step 2: Intern Signature (Draw or Upload + Saved Reuse) -->
          <div class="form-group" style="border-top:1px solid var(--border); padding-top:14px;">
            <label class="form-label">
              <span>2. Intern Signature *</span>
              <div style="display:flex; gap:6px;">
                ${
                  user.savedSignature
                    ? `<button type="button" class="btn btn-outline btn-sm" onclick="useSavedProfileSignature()">Use Saved Signature</button>`
                    : ""
                }
                <button type="button" class="btn btn-outline btn-sm" onclick="clearSignaturePad()">Clear Pad</button>
              </div>
            </label>

            <div class="sig-pad-container">
              <canvas id="intern-sig-canvas" class="sig-canvas" width="400" height="130"></canvas>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:11.5px; color:var(--text-muted); flex-wrap:wrap; gap:8px;">
                <span>Draw above with mouse/touch OR upload PNG/JPG:</span>
                <input type="file" id="sig-upload-input" accept="image/png,image/jpeg" style="font-size:11px; max-width:190px;" />
              </div>
            </div>
            <input type="hidden" id="f-signature" value="${escapeHtml(initialData.internSignature || "")}" />
            <label style="display:flex; align-items:center; gap:6px; font-size:12px; margin-top:8px; cursor:pointer;">
              <input type="checkbox" id="f-save-sig" checked />
              Save this signature to my profile for future requests
            </label>
          </div>

          <!-- Submit / Save Draft Actions -->
          <div style="display:flex; gap:10px; margin-top:20px;">
            <button type="button" class="btn btn-outline" style="flex:1;" onclick="saveOrSubmitRequest('draft')">
              📝 Save as Draft
            </button>
            <button type="button" id="btn-submit-req" class="btn btn-primary" style="flex:2;" onclick="saveOrSubmitRequest('submitted')">
              🚀 Sign & Submit Official Letter
            </button>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: LIVE LOCKED A4 LETTERHEAD PREVIEW -->
      <div class="preview-sticky">
        <div class="preview-toolbar">
          <span>📄 <strong>LIVE A4 LETTERHEAD PREVIEW</strong> — Locked Company Format</span>
          <span style="color:#fde68a;">Gold highlights = Intern variables</span>
        </div>
        <div class="preview-stage" id="live-a4-stage">
          <!-- Populated dynamically by updateLiveLetterPreview() -->
        </div>
      </div>
    </div>
  `;
}

function setFormAbsenceType(type) {
  const typeInput = document.getElementById("f-type");
  if (!typeInput) return;
  typeInput.value = type;

  document.querySelectorAll("#type-pills .radio-pill").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-type") === type);
  });

  document.getElementById("single-date-group").style.display = type === "multi" ? "none" : "";
  document.getElementById("multi-date-group").style.display = type === "multi" ? "" : "none";
  document.getElementById("half-shift-group").style.display = type === "half" ? "" : "none";

  updateLiveLetterPreview();
}

function gatherDraftFormObject() {
  const user = getCurrentUser();
  const memberType = document.getElementById("f-member-type")?.value || (user.role === "employee" ? "employee" : "intern");
  const type = document.getElementById("f-type")?.value || "full";
  const date = document.getElementById("f-date")?.value || "";
  const startDate = document.getElementById("f-start-date")?.value || "";
  const endDate = document.getElementById("f-end-date")?.value || "";
  const shift = document.getElementById("f-shift")?.value || "morning";
  const timeRange = document.getElementById("f-timerange")?.value || "";
  const reasonCategory = document.getElementById("f-category")?.value || "Academic";
  const reasonDetails = document.getElementById("f-details")?.value || "";
  const internSignature = document.getElementById("f-signature")?.value || "";

  let days = 1;
  let hoursImpact = 8;
  if (type === "half") {
    days = 0.5;
    hoursImpact = 4;
  } else if (type === "multi") {
    days = countWeekdaysBetween(startDate, endDate);
    hoursImpact = days * 8;
  }

  return {
    id: state.editingRequestId || "DRAFT-PREVIEW",
    refNo: null,
    uid: user.uid,
    memberType,
    snapshot: {
      name: user.name,
      internId: user.internId,
      position: user.position,
      department: user.department
    },
    type,
    date: type === "multi" ? null : date,
    startDate: type === "multi" ? startDate : null,
    endDate: type === "multi" ? endDate : null,
    days,
    shift: type === "half" ? shift : null,
    timeRange: type === "half" ? timeRange : null,
    hoursImpact,
    reasonCategory,
    reasonDetails,
    internSignature,
    status: "draft",
    createdAt: "2026-11-10T13:16:00+08:00"
  };
}

function updateLiveLetterPreview() {
  const stage = document.getElementById("live-a4-stage");
  if (!stage) return;

  const draftObj = gatherDraftFormObject();

  // Update character counter
  const counterEl = document.getElementById("char-counter");
  if (counterEl) {
    const len = draftObj.reasonDetails.trim().length;
    counterEl.textContent = `${len} / 400 chars (min 30)`;
    counterEl.style.color = len < 30 ? "#dc2626" : "#15803d";
  }

  // Update multi-day weekday hint
  const multiHint = document.getElementById("multi-days-hint");
  if (multiHint && draftObj.type === "multi") {
    multiHint.textContent = `Weekdays (Mon–Fri) counted: ${draftObj.days} weekday(s) (${draftObj.hoursImpact} hours deduction if approved)`;
  }

  // Check duplicate slot guard live
  const dupAlert = document.getElementById("duplicate-guard-alert");
  if (dupAlert) {
    const dup = checkDuplicateSlots(draftObj.uid, draftObj, state.editingRequestId);
    if (dup.conflict) {
      dupAlert.style.display = "block";
      dupAlert.innerHTML = `⚠️ <strong>Duplicate Absence Guard:</strong> You already have an active (${escapeHtml(dup.existingRequest.status)}) request covering <strong>${formatShortDate(dup.date)} (${dup.shift})</strong>.`;
    } else {
      dupAlert.style.display = "none";
    }
  }

  stage.innerHTML = renderLockedLetterHTML(draftObj, state.settings.letter, { highlightVars: true });
}

function initNewRequestInteractivity() {
  ["f-member-type", "f-date", "f-start-date", "f-end-date", "f-shift", "f-timerange", "f-category", "f-details"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => {
        if (id === "f-shift") {
          const tr = document.getElementById("f-timerange");
          if (tr) {
            tr.value = el.value === "morning" ? "8:00 AM – 12:00 PM" : "1:00 PM – 5:00 PM";
          }
        }
        updateLiveLetterPreview();
      });
      el.addEventListener("change", () => {
        updateLiveLetterPreview();
      });
    }
  });

  // Signature Canvas Drawing
  const canvas = document.getElementById("intern-sig-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#0c2340";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";

    // Draw existing signature if present
    const existingSig = document.getElementById("f-signature")?.value;
    if (existingSig) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 15, 260, 80);
      };
      img.src = existingSig;
    }

    let drawing = false;
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const moveDraw = (e) => {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const endDraw = () => {
      if (!drawing) return;
      drawing = false;
      document.getElementById("f-signature").value = canvas.toDataURL("image/png");
      updateLiveLetterPreview();
    };

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", moveDraw);
    window.addEventListener("mouseup", endDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", moveDraw, { passive: false });
    canvas.addEventListener("touchend", endDraw);
  }

  // Image upload for signature
  const uploadInput = document.getElementById("sig-upload-input");
  if (uploadInput) {
    uploadInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        document.getElementById("f-signature").value = dataUrl;
        const canvasEl = document.getElementById("intern-sig-canvas");
        if (canvasEl) {
          const ctx = canvasEl.getContext("2d");
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
            ctx.drawImage(img, 20, 15, 240, 85);
          };
          img.src = dataUrl;
        }
        updateLiveLetterPreview();
      };
      reader.readAsDataURL(file);
    });
  }

  updateLiveLetterPreview();
}

function clearSignaturePad() {
  const canvas = document.getElementById("intern-sig-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  const sigInput = document.getElementById("f-signature");
  if (sigInput) sigInput.value = "";
  updateLiveLetterPreview();
}

function useSavedProfileSignature() {
  const user = getCurrentUser();
  if (!user || !user.savedSignature) return;
  document.getElementById("f-signature").value = user.savedSignature;
  const canvas = document.getElementById("intern-sig-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 15, 260, 80);
    };
    img.src = user.savedSignature;
  }
  updateLiveLetterPreview();
  showToast("Applied saved signature from your profile.");
}

function saveOrSubmitRequest(targetStatus) {
  const user = getCurrentUser();
  const draft = gatherDraftFormObject();

  // Validations when submitting
  if (targetStatus === "submitted") {
    if (draft.type === "multi") {
      if (!draft.startDate || !draft.endDate || draft.endDate < draft.startDate) {
        showToast("Please select a valid Start Date and End Date.");
        return;
      }
      if (draft.days <= 0) {
        showToast("Selected date range contains 0 weekdays (Mon–Fri).");
        return;
      }
    } else if (!draft.date) {
      showToast("Please select the date of absence.");
      return;
    }

    // Backdate check: no past dates beyond 7 days back (2026-11-03)
    const checkDate = draft.type === "multi" ? draft.startDate : draft.date;
    if (checkDate < "2026-11-03") {
      showToast("Date cannot be more than 7 days in the past.");
      return;
    }

    const len = draft.reasonDetails.trim().length;
    if (len < 30 || len > 400) {
      showToast("Reason details must be between 30 and 400 characters.");
      return;
    }

    if (!draft.internSignature) {
      showToast("Your signature is required before submitting the official letter.");
      return;
    }

    const dup = checkDuplicateSlots(user.uid, draft, state.editingRequestId);
    if (dup.conflict) {
      showToast(`Duplicate blocked: You already have a request on ${dup.date} (${dup.shift}).`);
      return;
    }
  }

  // Save signature to profile if checked
  const saveSigCheckbox = document.getElementById("f-save-sig");
  if (saveSigCheckbox && saveSigCheckbox.checked && draft.internSignature) {
    state.users[user.uid].savedSignature = draft.internSignature;
  }

  const nowIso = new Date().toISOString();
  const reqId = state.editingRequestId || "req-2026-" + String(Object.keys(state.requests).length + 1).padStart(3, "0");
  const existingReq = state.requests[reqId];

  // Clear previous slots if editing an existing request
  if (existingReq) {
    Object.keys(state.absenceSlots).forEach((k) => {
      if (state.absenceSlots[k].requestId === reqId) {
        delete state.absenceSlots[k];
      }
    });
  }

  const history = existingReq ? [...existingReq.history] : [];
  history.push({
    status: targetStatus,
    byUid: user.uid,
    byName: user.name,
    remarks: targetStatus === "submitted"
      ? (existingReq && existingReq.status === "returned" ? "Revised and resubmitted letter." : "Submitted official absence request.")
      : "Saved as draft.",
    at: nowIso
  });

  state.requests[reqId] = {
    ...draft,
    id: reqId,
    status: targetStatus,
    review: existingReq ? existingReq.review : null,
    history,
    createdAt: existingReq ? existingReq.createdAt : nowIso,
    submittedAt: targetStatus === "submitted" ? nowIso : (existingReq ? existingReq.submittedAt : null),
    updatedAt: nowIso,
    templateVersion: state.settings.letter.templateVersion
  };

  // Write absenceSlots in transaction if submitted
  if (targetStatus === "submitted") {
    const slotKeys = computeSlotKeysForRequest(user.uid, draft);
    slotKeys.forEach((k) => {
      state.absenceSlots[k] = { requestId: reqId, uid: user.uid };
    });
  }

  state.editingRequestId = null;
  saveState();
  showToast(targetStatus === "submitted" ? "Request signed and submitted to HR!" : "Draft saved.");
  navigateTo("my-requests");
}

/* ==========================================
   SCREEN 4: MY REQUESTS (INTERN)
   (Withdraw while Submitted, Revise while Draft/Returned, PDF for Approved)
   ========================================== */
function renderMyRequestsScreen(user) {
  const filterStatus = window.myReqFilterStatus || "all";
  const allMyReqs = Object.values(state.requests)
    .filter((r) => r.uid === user.uid)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  const filtered = filterStatus === "all" ? allMyReqs : allMyReqs.filter((r) => r.status === filterStatus);

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">My Absence Requests</h1>
        <p class="page-subtitle">Track status, download approved A4 PDFs, revise returned letters, or withdraw pending requests.</p>
      </div>
      <button class="btn btn-primary" onclick="navigateTo('new-request', { editRequestId: null })">+ New Request</button>
    </div>

    <div class="card">
      <div class="card-header">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${["all", "submitted", "approved", "returned", "declined", "draft", "withdrawn"]
            .map(
              (st) => `
            <button class="btn ${filterStatus === st ? "btn-primary" : "btn-outline"} btn-sm" onclick="window.myReqFilterStatus='${st}'; renderApp();" style="text-transform:capitalize;">
              ${st === "all" ? `All (${allMyReqs.length})` : st}
            </button>
          `
            )
            .join("")}
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ref No. / ID</th>
              <th>Absence Type & Date(s)</th>
              <th>Category</th>
              <th>Hours Impact</th>
              <th>Status</th>
              <th>HR Remarks / Review</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              filtered.length === 0
                ? `<tr><td colspan="7" style="text-align:center; padding:28px; color:var(--text-muted);">No requests matching filter.</td></tr>`
                : filtered
                    .map(
                      (r) => `
              <tr class="${r.status === "withdrawn" ? "row-withdrawn" : ""}">
                <td>
                  <div style="font-weight:700; color:var(--apg-navy);">${escapeHtml(r.refNo || "—")}</div>
                  <div style="font-size:11.5px; color:var(--text-light);">${escapeHtml(r.id)}</div>
                </td>
                <td>
                  <div style="font-weight:600;">
                    ${
                      r.type === "multi"
                        ? `${formatShortDate(r.startDate)} – ${formatShortDate(r.endDate)} (${r.days}d)`
                        : formatShortDate(r.date)
                    }
                  </div>
                  <div style="font-size:11.5px; color:var(--text-muted); text-transform:capitalize;">
                    ${escapeHtml(r.type)} ${r.shift ? `· ${escapeHtml(r.shift)} (${escapeHtml(r.timeRange)})` : ""}
                  </div>
                </td>
                <td>${escapeHtml(r.reasonCategory)}</td>
                <td><strong>-${r.hoursImpact} h</strong></td>
                <td>${renderStatusPill(r.status)}</td>
                <td style="max-width:260px; font-size:12.5px;">
                  ${
                    r.review && r.review.remarks
                      ? `<div>"${escapeHtml(r.review.remarks)}"</div><div style="font-size:11px; color:var(--text-light);">— ${escapeHtml(r.review.byName)}</div>`
                      : `<span style="color:var(--text-light);">—</span>`
                  }
                </td>
                <td>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-outline btn-sm" onclick="openLetterModal('${r.id}')">View Letter</button>
                    ${
                      r.status === "draft" || r.status === "returned"
                        ? `<button class="btn btn-warning btn-sm" onclick="navigateTo('new-request', { editRequestId: '${r.id}' })">Edit / Revise</button>`
                        : ""
                    }
                    ${
                      r.status === "submitted"
                        ? `<button class="btn btn-danger btn-sm" onclick="withdrawSubmittedRequest('${r.id}')">Withdraw</button>`
                        : ""
                    }
                    ${
                      r.status === "approved"
                        ? `<button class="btn btn-primary btn-sm" onclick="downloadRequestPDF('${r.id}')">⬇ PDF</button>`
                        : ""
                    }
                  </div>
                </td>
              </tr>
            `
                    )
                    .join("")
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function withdrawSubmittedRequest(reqId) {
  const req = state.requests[reqId];
  const user = getCurrentUser();
  if (!req || req.status !== "submitted") return;

  req.status = "withdrawn";
  req.updatedAt = new Date().toISOString();
  req.history.push({
    status: "withdrawn",
    byUid: user.uid,
    byName: user.name,
    remarks: "Withdrawn by intern prior to HR review.",
    at: req.updatedAt
  });

  // Free duplicate guard absenceSlots
  Object.keys(state.absenceSlots).forEach((k) => {
    if (state.absenceSlots[k].requestId === reqId) {
      delete state.absenceSlots[k];
    }
  });

  saveState();
  showToast(`Request ${reqId} withdrawn and absence slots released.`);
  renderApp();
}

/* ==========================================
   SCREEN 5: HR REVIEW QUEUE & ANALYTICS + CSV
   ========================================== */
function renderHRQueueScreen() {
  const statusFilter = window.hrFilterStatus || "all";
  const reasonFilter = window.hrFilterReason || "all";
  const deptFilter = window.hrFilterDept || "all";

  const allReqs = Object.values(state.requests)
    .filter((r) => r.status !== "draft")
    .sort((a, b) => {
      // Pending ("submitted") always first!
      if (a.status === "submitted" && b.status !== "submitted") return -1;
      if (a.status !== "submitted" && b.status === "submitted") return 1;
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });

  const filtered = allReqs.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (reasonFilter !== "all" && r.reasonCategory !== reasonFilter) return false;
    if (deptFilter !== "all" && r.snapshot?.department !== deptFilter) return false;
    return true;
  });

  // Analytics counts
  const pendingCount = allReqs.filter((r) => r.status === "submitted").length;
  const approvedCount = allReqs.filter((r) => r.status === "approved").length;
  const returnedCount = allReqs.filter((r) => r.status === "returned").length;
  const totalApprovedHours = allReqs
    .filter((r) => r.status === "approved")
    .reduce((acc, r) => acc + (Number(r.hoursImpact) || 0), 0);

  // Breakdown by Reason Category
  const byReason = {};
  allReqs.forEach((r) => {
    byReason[r.reasonCategory] = (byReason[r.reasonCategory] || 0) + 1;
  });

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">HR Review Queue & Analytics</h1>
        <p class="page-subtitle">Pending requests appear first. Click any request to open the side-by-side Locked Letter Review screen.</p>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-outline" onclick="navigateTo('hr-calendar')">📅 Attendance Calendar</button>
        <button class="btn btn-gold" onclick="exportFilteredRequestsCSV()">⬇ Export Filtered CSV</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card" style="border-left:4px solid #eab308;">
        <div class="stat-label">Pending HR Review</div>
        <div class="stat-value">${pendingCount}</div>
        <div class="stat-sub">Prioritized at top of queue</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #16a34a;">
        <div class="stat-label">Approved Letters</div>
        <div class="stat-value">${approvedCount}</div>
        <div class="stat-sub">Next Ref: APG-EL-2026-${String(state.counters["2026"].nextRefNo).padStart(4, "0")}</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #ea580c;">
        <div class="stat-label">Returned for Revision</div>
        <div class="stat-value">${returnedCount}</div>
        <div class="stat-sub">Awaiting intern edits</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Approved Absence Hours</div>
        <div class="stat-value">${totalApprovedHours} h</div>
        <div class="stat-sub">Across all active interns</div>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="card">
      <div class="card-header" style="flex-wrap:wrap;">
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <strong style="font-size:13px; color:var(--apg-navy);">Filter Queue:</strong>
          <select class="form-control" style="width:auto; padding:6px 10px;" onchange="window.hrFilterStatus=this.value; renderApp();">
            <option value="all" ${statusFilter === "all" ? "selected" : ""}>All Statuses (${allReqs.length})</option>
            <option value="submitted" ${statusFilter === "submitted" ? "selected" : ""}>🟡 Submitted (Pending)</option>
            <option value="approved" ${statusFilter === "approved" ? "selected" : ""}>🟢 Approved</option>
            <option value="returned" ${statusFilter === "returned" ? "selected" : ""}>🟠 Returned</option>
            <option value="declined" ${statusFilter === "declined" ? "selected" : ""}>🔴 Declined</option>
            <option value="withdrawn" ${statusFilter === "withdrawn" ? "selected" : ""}>⚪ Withdrawn</option>
          </select>

          <select class="form-control" style="width:auto; padding:6px 10px;" onchange="window.hrFilterReason=this.value; renderApp();">
            <option value="all" ${reasonFilter === "all" ? "selected" : ""}>All Reason Categories</option>
            ${["Academic", "Medical", "Family emergency", "School activity", "Personal", "Other"]
              .map((c) => `<option value="${c}" ${reasonFilter === c ? "selected" : ""}>${c}</option>`)
              .join("")}
          </select>

          <select class="form-control" style="width:auto; padding:6px 10px;" onchange="window.hrFilterDept=this.value; renderApp();">
            <option value="all" ${deptFilter === "all" ? "selected" : ""}>All Departments</option>
            <option value="Marketing & HR" ${deptFilter === "Marketing & HR" ? "selected" : ""}>Marketing & HR</option>
            <option value="Operations" ${deptFilter === "Operations" ? "selected" : ""}>Operations</option>
          </select>
        </div>

        <div style="font-size:12px; color:var(--text-muted);">
          Reason Analytics: ${Object.entries(byReason).map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${v}`).join(" · ")}
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ref No.</th>
              <th>Intern (Snapshot)</th>
              <th>Absence Type & Date(s)</th>
              <th>Reason Category</th>
              <th>Hours</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map(
                (r) => `
              <tr class="${r.status === "withdrawn" ? "row-withdrawn" : ""}">
                <td>
                  <div style="font-weight:700; color:var(--apg-navy);">${escapeHtml(r.refNo || "Pending")}</div>
                  <div style="font-size:11px; color:var(--text-light);">${escapeHtml(r.id)}</div>
                </td>
                <td>
                  <div style="font-weight:700;">${escapeHtml(r.snapshot?.name)}</div>
                  <div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(r.snapshot?.position)} · <code>${escapeHtml(r.snapshot?.internId)}</code></div>
                </td>
                <td>
                  <div style="font-weight:600;">
                    ${
                      r.type === "multi"
                        ? `${formatShortDate(r.startDate)} – ${formatShortDate(r.endDate)} (${r.days}d)`
                        : formatShortDate(r.date)
                    }
                  </div>
                  <div style="font-size:11.5px; color:var(--text-muted); text-transform:capitalize;">
                    ${escapeHtml(r.type)} ${r.shift ? `(${escapeHtml(r.shift)})` : ""}
                  </div>
                </td>
                <td>${escapeHtml(r.reasonCategory)}</td>
                <td><strong>-${r.hoursImpact} h</strong></td>
                <td>${renderStatusPill(r.status)}</td>
                <td>
                  <button class="btn ${r.status === "submitted" ? "btn-primary" : "btn-outline"} btn-sm" onclick="navigateTo('hr-review', { reviewRequestId: '${r.id}' })">
                    ${r.status === "submitted" ? "Review & Act →" : "Inspect Letter"}
                  </button>
                  ${
                    r.status === "approved"
                      ? `<button class="btn btn-outline btn-sm" onclick="downloadRequestPDF('${r.id}')">PDF</button>`
                      : ""
                  }
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function exportFilteredRequestsCSV() {
  const allReqs = Object.values(state.requests).filter((r) => r.status !== "draft");
  const headers = ["RefNo", "RequestID", "MemberName", "MemberID", "Position", "Department", "Type", "DateOrRange", "Shift", "HoursImpact", "ReasonCategory", "Status", "ReviewedBy", "ReviewRemarks"];
  const rows = allReqs.map((r) => [
    r.refNo || "",
    r.id,
    r.snapshot?.name || "",
    r.snapshot?.internId || "",
    r.snapshot?.position || "",
    r.snapshot?.department || "",
    r.type,
    r.type === "multi" ? `${r.startDate} to ${r.endDate}` : r.date,
    r.shift || "full",
    r.hoursImpact,
    r.reasonCategory,
    r.status,
    r.review?.byName || "",
    (r.review?.remarks || "").replace(/"/g, '""')
  ]);

  const csvContent =
    headers.join(",") +
    "\n" +
    rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AlphaPremier_Absences_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported filtered absence analytics to CSV.");
}

/* ==========================================
   SCREEN 6: HR REVIEW SCREEN
   (Rendered A4 Letter + Intern History + Firestore Approval Transaction)
   ========================================== */
function renderHRReviewScreen() {
  const reqId = state.selectedRequestIdForReview || Object.keys(state.requests)[0];
  const req = state.requests[reqId];
  if (!req) {
    return `<div class="card"><div class="card-body">Select a request from the HR Queue.</div></div>`;
  }

  const internHistory = Object.values(state.requests).filter(
    (r) => r.uid === req.uid && r.id !== req.id && r.status !== "draft"
  );
  const internHours = computeInternHoursStats(req.uid);

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">HR Request Review: ${escapeHtml(req.snapshot?.name)}</h1>
        <p class="page-subtitle">Request ID: <code>${escapeHtml(req.id)}</code> · Current Status: ${renderStatusPill(req.status)}</p>
      </div>
      <div style="display:flex; gap:8px;">
        ${
          req.status === "approved"
            ? `<button class="btn btn-gold" onclick="downloadRequestPDF('${req.id}')">⬇ Download Official A4 PDF</button>`
            : ""
        }
        <button class="btn btn-outline" onclick="navigateTo('hr-queue')">← Back to HR Queue</button>
      </div>
    </div>

    <div class="split-workspace">
      <!-- LEFT COLUMN: HR DECISION PANEL, METADATA, INTERN HISTORY & AUDIT TRAIL -->
      <div>
        <!-- HR Action Box -->
        <div class="card" style="border-top:4px solid var(--apg-navy);">
          <div class="card-header">
            <span class="card-title">⚖️ HR Officer Decision</span>
            <span style="font-size:11.5px; color:var(--text-muted);">Signatory: ${escapeHtml(state.settings.letter.signatoryName)}</span>
          </div>
          <div class="card-body">
            ${
              req.status === "submitted"
                ? `
              <div class="form-group">
                <label class="form-label">
                  <span>HR Review Remarks</span>
                  <span style="font-weight:400; font-size:11.5px; color:var(--text-light);">Required for Return or Decline</span>
                </label>
                <textarea id="hr-review-remarks" class="form-control" rows="3" placeholder="Enter approval note, or specify why the request is being returned for revision or declined..."></textarea>
              </div>
              <div style="background:#f8fafc; border:1px solid var(--border); padding:10px 12px; border-radius:7px; font-size:12px; margin-bottom:14px;">
                <strong>On Approval Transaction:</strong> Assigns next reference number <code>APG-EL-2026-${String(state.counters["2026"].nextRefNo).padStart(4, "0")}</code>, stamps Ms. Chico's HR signature & approval date onto the letter, and deducts <strong>${req.hoursImpact} hours</strong> from hours balance.
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn-success" style="flex:1.2;" onclick="handleHRDecision('${req.id}', 'approved')">
                  ✓ Approve & Stamp Letter
                </button>
                <button class="btn btn-warning" style="flex:1;" onclick="handleHRDecision('${req.id}', 'returned')">
                  🟠 Return for Revision
                </button>
                <button class="btn btn-danger" style="flex:1;" onclick="handleHRDecision('${req.id}', 'declined')">
                  ✕ Decline
                </button>
              </div>
            `
                : `
              <div style="font-size:13.5px;">
                <div style="margin-bottom:8px;">This request is currently <strong>${escapeHtml(req.status.toUpperCase())}</strong>.</div>
                ${
                  req.review
                    ? `<div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid var(--border);">
                        <div><strong>Reviewed by:</strong> ${escapeHtml(req.review.byName)} on ${formatShortDate(req.review.at)}</div>
                        <div style="margin-top:4px;"><strong>Remarks:</strong> "${escapeHtml(req.review.remarks || "No remarks")}"</div>
                      </div>`
                    : ""
                }
              </div>
            `
            }
          </div>
        </div>

        <!-- Request Details & Member Hours Snapshot -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">📌 Request Metadata & Hours Impact</span>
          </div>
          <div class="card-body" style="font-size:13px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
              <div><strong>Name:</strong> ${escapeHtml(req.snapshot?.name)}</div>
              <div><strong>ID Number:</strong> <code>${escapeHtml(req.snapshot?.internId)}</code></div>
              <div><strong>Member Type:</strong> <span class="user-role-tag">${escapeHtml(req.memberType || "intern")}</span></div>
              <div><strong>Position:</strong> ${escapeHtml(req.snapshot?.position)}</div>
              <div><strong>Reason Category:</strong> ${escapeHtml(req.reasonCategory)}</div>
              <div><strong>Hours Impact:</strong> -${req.hoursImpact} hours</div>
              <div><strong>Remaining Hours:</strong> ${internHours.remaining} / ${internHours.required} h</div>
            </div>
          </div>
        </div>

        <!-- Intern's Past Absence History -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">📂 Intern's Other Absence Requests (${internHistory.length})</span>
          </div>
          <div class="card-body">
            ${
              internHistory.length === 0
                ? `<div style="color:var(--text-muted); font-size:13px;">No other requests filed by this intern.</div>`
                : internHistory
                    .map(
                      (h) => `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                    <div>
                      <strong>${h.type === "multi" ? `${formatShortDate(h.startDate)} – ${formatShortDate(h.endDate)}` : formatShortDate(h.date)}</strong>
                      <span style="color:var(--text-muted);"> · ${escapeHtml(h.reasonCategory)} (-${h.hoursImpact}h)</span>
                    </div>
                    <div>${renderStatusPill(h.status)}</div>
                  </div>
                `
                    )
                    .join("")
            }
          </div>
        </div>

        <!-- Audit Trail Timeline -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">🕒 Immutable Audit Trail</span>
          </div>
          <div class="card-body">
            <ul class="timeline">
              ${(req.history || [])
                .map(
                  (item) => `
                <li class="timeline-item">
                  <div style="display:flex; align-items:center; gap:8px;">
                    ${renderStatusPill(item.status)}
                    <span style="font-size:11.5px; color:var(--text-light);">${formatShortDate(item.at)}</span>
                  </div>
                  <div style="font-size:12.5px; font-weight:600; margin-top:3px;">Actor: ${escapeHtml(item.byName)}</div>
                  <div style="font-size:12.5px; color:var(--text-muted);">${escapeHtml(item.remarks)}</div>
                </li>
              `
                )
                .join("")}
            </ul>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: OFFICIAL LOCKED A4 LETTER PREVIEW -->
      <div class="preview-sticky">
        <div class="preview-toolbar">
          <span>📄 <strong>OFFICIAL RENDERED A4 LETTER</strong></span>
          <span>${req.refNo ? `Ref: ${escapeHtml(req.refNo)}` : "Unapproved Preview"}</span>
        </div>
        <div class="preview-stage">
          ${renderLockedLetterHTML(req, state.settings.letter, { highlightVars: false })}
        </div>
      </div>
    </div>
  `;
}

function handleHRDecision(reqId, newStatus) {
  const req = state.requests[reqId];
  const hrUser = getCurrentUser();
  if (!req || !hrUser || hrUser.role !== "hr") return;

  const remarksEl = document.getElementById("hr-review-remarks");
  const remarks = remarksEl ? remarksEl.value.trim() : "";

  if ((newStatus === "returned" || newStatus === "declined") && !remarks) {
    showToast(`Remarks are required when marking a request as ${newStatus.toUpperCase()}.`);
    if (remarksEl) remarksEl.focus();
    return;
  }

  const nowIso = new Date().toISOString();

  if (newStatus === "approved") {
    // Firestore Approval Transaction Simulation:
    // 1. Pull next reference number from counters/{year}
    const year = "2026";
    const seq = state.counters[year].nextRefNo;
    state.counters[year].nextRefNo = seq + 1;
    const refNo = `APG-EL-${year}-${String(seq).padStart(4, "0")}`;

    // 2. Copy HR signature, approver uid/name and approval date onto request
    req.refNo = refNo;
    req.status = "approved";
    req.review = {
      byUid: hrUser.uid,
      byName: hrUser.name,
      remarks: remarks || "Approved.",
      at: nowIso,
      hrSignature: state.settings.letter.hrSignature
    };
  } else {
    req.status = newStatus;
    req.review = {
      byUid: hrUser.uid,
      byName: hrUser.name,
      remarks,
      at: nowIso,
      hrSignature: null
    };

    // Release absenceSlots if returned or declined so intern can re-file or edit
    Object.keys(state.absenceSlots).forEach((k) => {
      if (state.absenceSlots[k].requestId === reqId) {
        delete state.absenceSlots[k];
      }
    });
  }

  req.updatedAt = nowIso;
  req.history.push({
    status: newStatus,
    byUid: hrUser.uid,
    byName: hrUser.name,
    remarks: req.review.remarks,
    at: nowIso
  });

  saveState();
  showToast(
    newStatus === "approved"
      ? `Approved! Reference No. ${req.refNo} assigned and HR signature stamped.`
      : `Request marked as ${newStatus}.`
  );
  renderApp();
}

/* ==========================================
   SCREEN 7: HR ATTENDANCE CALENDAR
   (Month Grid of Absences across all interns)
   ========================================== */
function renderHRCalendarScreen() {
  const baseDate = new Date(2026, 10 + (state.calendarMonthOffset || 0), 1); // Nov 2026 default
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const monthLabel = baseDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstDayDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const statusFilter = window.calStatusFilter || "all";

  // Map date YYYY-MM-DD -> array of absence entries
  const dateMap = {};
  Object.values(state.requests).forEach((r) => {
    if (r.status !== "approved" && r.status !== "submitted") return;
    if (statusFilter !== "all" && r.status !== statusFilter) return;

    const dates =
      r.type === "multi"
        ? getWeekdayDatesList(r.startDate, r.endDate)
        : r.date
        ? [r.date]
        : [];

    dates.forEach((d) => {
      if (!dateMap[d]) dateMap[d] = [];
      dateMap[d].push(r);
    });
  });

  const cellsHTML = [];
  for (let i = 0; i < firstDayDow; i++) {
    cellsHTML.push(`<div class="cal-cell cal-other-month"></div>`);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const events = dateMap[ymd] || [];
    cellsHTML.push(`
      <div class="cal-cell">
        <div class="cal-date-num">${day}</div>
        ${events
          .map(
            (ev) => `
          <div class="cal-event ${ev.status}" onclick="navigateTo('hr-review', { reviewRequestId: '${ev.id}' })" title="Click to review ${escapeHtml(ev.snapshot?.name)}">
            ${ev.type === "half" ? (ev.shift === "morning" ? "[AM]" : "[PM]") : "[FULL]"} ${escapeHtml(ev.snapshot?.name.split(" ")[0])}
          </div>
        `
          )
          .join("")}
      </div>
    `);
  }

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">HR Attendance & Absence Calendar</h1>
        <p class="page-subtitle">Month view of approved and pending intern absences. Click any badge to inspect the official letter.</p>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <select class="form-control" style="width:auto;" onchange="window.calStatusFilter=this.value; renderApp();">
          <option value="all" ${statusFilter === "all" ? "selected" : ""}>Approved + Pending</option>
          <option value="approved" ${statusFilter === "approved" ? "selected" : ""}>🟢 Approved Only</option>
          <option value="submitted" ${statusFilter === "submitted" ? "selected" : ""}>🟡 Pending Only</option>
        </select>
        <button class="btn btn-outline btn-sm" onclick="state.calendarMonthOffset--; renderApp();">← Prev</button>
        <strong style="min-width:140px; text-align:center;">${monthLabel}</strong>
        <button class="btn btn-outline btn-sm" onclick="state.calendarMonthOffset++; renderApp();">Next →</button>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="calendar-grid">
          ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            .map((d) => `<div class="cal-day-header">${d}</div>`)
            .join("")}
          ${cellsHTML.join("")}
        </div>
      </div>
    </div>
  `;
}

/* ==========================================
   SCREEN 8: HR SETTINGS & INTERN ACCOUNTS
   (Locked Letter Settings + Feature Flag + Intern Account Activation)
   ========================================== */
function renderHRSettingsScreen() {
  const s = state.settings.letter;
  const members = Object.values(state.users).filter((u) => u.role === "intern" || u.role === "employee");

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">HR Settings, Locked Template & Member Accounts</h1>
        <p class="page-subtitle">Manage the locked Alpha Premier letter wording, Ms. Chico's approval signature, feature flags, and member profile activation.</p>
      </div>
    </div>

    <div class="grid-2">
      <!-- Locked Letter Content & Signatory Settings -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🔒 Locked Company Letter Settings (<code>settings/letter</code>)</span>
          <span style="font-size:12px; color:var(--text-muted);">Template v${escapeHtml(s.templateVersion)}</span>
        </div>
        <div class="card-body">
          <form onsubmit="saveLetterSettings(event)">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="form-group">
                <label class="form-label">HR Signatory Name</label>
                <input type="text" id="set-sig-name" class="form-control" value="${escapeHtml(s.signatoryName)}" required />
              </div>
              <div class="form-group">
                <label class="form-label">HR Signatory Title</label>
                <input type="text" id="set-sig-title" class="form-control" value="${escapeHtml(s.signatoryTitle)}" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Official Subject Line</label>
              <input type="text" id="set-subject" class="form-control" value="${escapeHtml(s.subject)}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Letter Salutation Greeting</label>
              <input type="text" id="set-salutation" class="form-control" value="${escapeHtml(s.salutation || "Good day, Ma'am!")}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Company Header Address Block</label>
              <textarea id="set-address" class="form-control" rows="3" required>${escapeHtml(s.addressBlock)}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Locked Apology & Handover Paragraph (3rd Paragraph)</label>
              <textarea id="set-apology" class="form-control" rows="3" required>${escapeHtml(s.apologyParagraph)}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Locked Thank-You Closing Paragraph (4th Paragraph)</label>
              <textarea id="set-thanks" class="form-control" rows="2" required>${escapeHtml(s.thankYouParagraph)}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">
                <span>Ms. Chico's Approval Signature (Stamped automatically on Approval)</span>
                <button type="button" class="btn btn-outline btn-sm" onclick="resetDefaultHRSignature()">Reset Default</button>
              </label>
              <div class="sig-pad-container">
                <canvas id="hr-sig-canvas" class="sig-canvas" width="400" height="110"></canvas>
                <input type="hidden" id="set-hr-sig" value="${escapeHtml(s.hrSignature)}" />
              </div>
            </div>

            <div class="form-group" style="background:#f8fafc; border:1px solid var(--border); padding:12px; border-radius:8px;">
              <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; font-weight:600; font-size:13.5px;">
                <span>📎 Enable Firebase Storage Attachments (<code>attachmentsEnabled</code>)</span>
                <input type="checkbox" id="set-attachments" ${s.attachmentsEnabled ? "checked" : ""} style="width:18px; height:18px;" />
              </label>
              <div class="form-hint">Decision #4: Keep off until Firebase Storage (Blaze plan) is enabled, or toggle on now to test the file attachment field in the form.</div>
            </div>

            <button type="submit" class="btn btn-primary" style="width:100%;">Save Locked Letterhead Settings</button>
          </form>
        </div>
      </div>

      <!-- Member Account Management & Activation -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">👥 Member Accounts & Profile Lock (<code>users/{uid}</code>)</span>
          <span style="font-size:11.5px; color:var(--text-muted);">HR sets ID, Position & Role</span>
        </div>
        <div class="card-body">
          <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:14px;">
            Members cannot edit their own ID Number, Position, Department, or Required Hours—preventing formatting typos like <em>"MarketingAssociate"</em> on official letters.
          </p>

          ${members
            .map(
              (u) => `
            <div style="border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:12px; background:${u.status === "pending" ? "#fffbeb" : "#ffffff"};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                  <strong style="font-size:14px; color:var(--apg-navy);">${escapeHtml(u.name)}</strong>
                  <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(u.email)}</div>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                  <span class="user-role-tag">${escapeHtml(u.role || "intern")}</span>
                  <span class="status-pill ${u.status === "active" ? "status-approved" : u.status === "pending" ? "status-submitted" : "status-declined"}">
                    ${escapeHtml(u.status)}
                  </span>
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                <div>
                  <label style="font-size:11px; font-weight:700; color:var(--text-muted);">MEMBER TYPE</label>
                  <select id="u-role-${u.uid}" class="form-control" style="padding:6px 9px; font-size:12.5px;">
                    <option value="intern" ${u.role === "intern" ? "selected" : ""}>Intern</option>
                    <option value="employee" ${u.role === "employee" ? "selected" : ""}>Employee</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:11px; font-weight:700; color:var(--text-muted);">ID NUMBER</label>
                  <input type="text" id="u-id-${u.uid}" class="form-control" style="padding:6px 9px; font-size:12.5px;" value="${escapeHtml(u.internId)}" placeholder="e.g. APG-INT-2026-025 or APG-EMP-001" />
                </div>
                <div style="grid-column: span 2;">
                  <label style="font-size:11px; font-weight:700; color:var(--text-muted);">DEPARTMENT</label>
                  <input type="text" id="u-dept-${u.uid}" class="form-control" style="padding:6px 9px; font-size:12.5px;" value="${escapeHtml(u.department)}" placeholder="e.g. Marketing & HR" />
                </div>
                <div style="grid-column: span 2;">
                  <label style="font-size:11px; font-weight:700; color:var(--text-muted);">OFFICIAL POSITION TITLE (LANDS ON LETTER)</label>
                  <input type="text" id="u-pos-${u.uid}" class="form-control" style="padding:6px 9px; font-size:12.5px;" value="${escapeHtml(u.position)}" placeholder="e.g. HR/Marketing Associate or Operations Specialist" />
                </div>
                <div>
                  <label style="font-size:11px; font-weight:700; color:var(--text-muted);">REQUIRED / TARGET HOURS</label>
                  <input type="number" id="u-reqh-${u.uid}" class="form-control" style="padding:6px 9px; font-size:12.5px;" value="${u.requiredHours || 0}" />
                </div>
                <div>
                  <label style="font-size:11px; font-weight:700; color:var(--text-muted);">RENDERED / CREDITED HOURS</label>
                  <input type="number" id="u-renh-${u.uid}" class="form-control" style="padding:6px 9px; font-size:12.5px;" value="${u.renderedHours || 0}" />
                </div>
              </div>

              <div style="display:flex; gap:8px; justify-content:flex-end;">
                ${
                  u.status === "pending"
                    ? `<button class="btn btn-success btn-sm" onclick="updateInternAccountByHR('${u.uid}', 'active')">✓ Activate & Save Profile</button>`
                    : `<button class="btn btn-primary btn-sm" onclick="updateInternAccountByHR('${u.uid}', 'active')">Save Profile Changes</button>`
                }
                ${
                  u.status !== "disabled"
                    ? `<button class="btn btn-outline btn-sm" onclick="updateInternAccountByHR('${u.uid}', 'disabled')">Disable</button>`
                    : `<button class="btn btn-outline btn-sm" onclick="updateInternAccountByHR('${u.uid}', 'active')">Re-enable</button>`
                }
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function initHRSettingsSignatureCanvas() {
  const canvas = document.getElementById("hr-sig-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#0c2340";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";

  const currentSig = document.getElementById("set-hr-sig")?.value;
  if (currentSig) {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 10, 250, 75);
    };
    img.src = currentSig;
  }

  let drawing = false;
  canvas.addEventListener("mousedown", (e) => {
    drawing = true;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(((e.clientX - rect.left) / rect.width) * canvas.width, ((e.clientY - rect.top) / rect.height) * canvas.height);
  });
  canvas.addEventListener("mousemove", (e) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(((e.clientX - rect.left) / rect.width) * canvas.width, ((e.clientY - rect.top) / rect.height) * canvas.height);
    ctx.stroke();
  });
  window.addEventListener("mouseup", () => {
    if (!drawing) return;
    drawing = false;
    const sigInput = document.getElementById("set-hr-sig");
    if (sigInput) sigInput.value = canvas.toDataURL("image/png");
  });
}

function resetDefaultHRSignature() {
  const sigInput = document.getElementById("set-hr-sig");
  if (sigInput) sigInput.value = DEFAULT_HR_SIG;
  initHRSettingsSignatureCanvas();
  showToast("Restored Ms. Chico's default signature.");
}

function saveLetterSettings(e) {
  e.preventDefault();
  const s = state.settings.letter;
  s.signatoryName = document.getElementById("set-sig-name").value.trim();
  s.signatoryTitle = document.getElementById("set-sig-title").value.trim();
  s.subject = document.getElementById("set-subject").value.trim();
  s.salutation = document.getElementById("set-salutation").value.trim();
  s.addressBlock = document.getElementById("set-address").value;
  s.apologyParagraph = document.getElementById("set-apology").value.trim();
  s.thankYouParagraph = document.getElementById("set-thanks").value.trim();
  s.hrSignature = document.getElementById("set-hr-sig").value;
  s.attachmentsEnabled = document.getElementById("set-attachments").checked;

  // Bump template version minor
  const parts = String(s.templateVersion || "1.0").split(".");
  s.templateVersion = `${parts[0]}.${Number(parts[1] || 0) + 1}`;

  saveState();
  showToast(`Saved locked letter settings (Template v${s.templateVersion}).`);
  renderApp();
}

function updateInternAccountByHR(uid, newStatus) {
  const u = state.users[uid];
  if (!u) return;

  const role = document.getElementById(`u-role-${uid}`)?.value || u.role || "intern";
  const internId = document.getElementById(`u-id-${uid}`)?.value.trim() || "";
  const dept = document.getElementById(`u-dept-${uid}`)?.value.trim() || "";
  const pos = document.getElementById(`u-pos-${uid}`)?.value.trim() || "";
  const reqH = Number(document.getElementById(`u-reqh-${uid}`)?.value) || 0;
  const renH = Number(document.getElementById(`u-renh-${uid}`)?.value) || 0;

  if (newStatus === "active" && (!internId || !pos || !dept)) {
    showToast("Please assign an ID Number, Official Position, and Department to activate this member.");
    return;
  }

  u.role = role;
  u.memberType = role;
  u.internId = internId;
  u.department = dept;
  u.position = pos;
  u.requiredHours = reqH;
  u.renderedHours = renH;
  u.status = newStatus;

  saveState();
  showToast(`Updated profile for ${u.name} (${newStatus.toUpperCase()}).`);
  renderApp();
}

/* ==========================================
   MODAL LETTER VIEWER
   ========================================== */
function openLetterModal(reqId) {
  const req = state.requests[reqId];
  const modalRoot = document.getElementById("modal-root");
  if (!req || !modalRoot) return;

  modalRoot.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) closeLetterModal()">
      <div class="modal-box">
        <div class="preview-toolbar" style="border-radius:0;">
          <span>📄 <strong>A4 LETTER PREVIEW</strong> · ${escapeHtml(req.refNo || req.id)}</span>
          <div style="display:flex; gap:8px;">
            ${
              req.status === "approved"
                ? `<button class="btn btn-gold btn-sm" onclick="downloadRequestPDF('${req.id}')">⬇ Download PDF</button>`
                : ""
            }
            <button class="btn btn-outline btn-sm" style="background:transparent; color:#fff; border-color:rgba(255,255,255,0.4);" onclick="closeLetterModal()">✕ Close</button>
          </div>
        </div>
        <div class="preview-stage" style="border:none;">
          ${renderLockedLetterHTML(req, state.settings.letter, { highlightVars: false })}
        </div>
      </div>
    </div>
  `;
}

function closeLetterModal() {
  const modalRoot = document.getElementById("modal-root");
  if (modalRoot) modalRoot.innerHTML = "";
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    renderApp();
  });
} else {
  renderApp();
}
