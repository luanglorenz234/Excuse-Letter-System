/**
 * Alpha Premier — Absence Request System (Final v1.0)
 * Core Application Logic, Pure Letter Renderer, Firestore State & PDF Export
 */

const STORAGE_KEY = "APG_SYSTEM_V4_STATE";

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

// Group letter wording (several people filing one letter for the same reason)
const DEFAULT_GROUP_APOLOGY =
  "We sincerely apologize for any inconvenience our absence may cause and assure you that we will make every effort to catch up on any missed responsibilities upon our return.";
const DEFAULT_GROUP_THANKS =
  "Thank you for your understanding and consideration. We appreciate your support regarding this matter.";

// Most people on one letter (the person filing + others). Keeps the letter on a single A4 page.
const MAX_GROUP_SIZE = 6;

// Initial Seed State matching Section 6 Data Model
function getInitialSeedState() {
  return {
    currentUserUid: null,
    currentScreen: "home", // see navigation router
    selectedRequestIdForReview: "req-2026-003",
    editingRequestId: null,
    calendarMonthOffset: 0, // 0 = current month
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
        // Used when several interns/employees file one letter together
        apologyParagraphGroup: DEFAULT_GROUP_APOLOGY,
        thankYouParagraphGroup: DEFAULT_GROUP_THANKS,
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
      "demo-intern": {
        uid: "intern-juan",
        name: "Juan Miguel Dela Cruz",
        email: "demo@intern.com",
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
      "intern-john": {
        uid: "intern-john",
        name: "John Paolo Santos",
        email: "john.santos@university.edu.ph",
        internId: "APG-INT-2026-021",
        position: "HR/Marketing Associate Intern",
        department: "Marketing & HR",
        role: "intern",
        memberType: "intern",
        status: "active",
        requiredHours: 480,
        renderedHours: 0,
        savedSignature: "",
        createdAt: "2026-09-01T08:30:00+08:00"
      },
      "intern-mark": {
        uid: "intern-mark",
        name: "Mark Anthony Villanueva",
        email: "mark.villanueva@university.edu.ph",
        internId: "APG-INT-2026-022",
        position: "Operations & Finance Intern",
        department: "Operations",
        role: "intern",
        memberType: "intern",
        status: "active",
        requiredHours: 480,
        renderedHours: 0,
        savedSignature: "",
        createdAt: "2026-09-01T08:30:00+08:00"
      },
      "intern-kevs": {
        uid: "intern-kevs",
        name: "Kevin Ramos (Kevs)",
        email: "kevin.ramos@university.edu.ph",
        internId: "APG-INT-2026-023",
        position: "IT Support Intern",
        department: "Operations",
        role: "intern",
        memberType: "intern",
        status: "active",
        requiredHours: 480,
        renderedHours: 0,
        savedSignature: "",
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
  const seed = getInitialSeedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure seed users & essential structures exist even if loaded from older localStorage
      parsed.users = { ...seed.users, ...(parsed.users || {}) };
      parsed.settings = parsed.settings || seed.settings;
      parsed.requests = parsed.requests || seed.requests;
      return parsed;
    }
  } catch (e) {
    console.warn("Could not read state from localStorage", e);
  }
  return seed;
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

/* Current-date helpers (local time) — replaces hardcoded 2026 dates */
function toYmd(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayYmd() {
  return toYmd(new Date());
}

function addDaysYmd(ymd, n) {
  const dt = parseLocalDate(ymd);
  dt.setDate(dt.getDate() + n);
  return toYmd(dt);
}

function currentYear() {
  return String(new Date().getFullYear());
}

// Earliest date a request may cover: 7 days back from today
function getMinFilingDate() {
  return addDaysYmd(todayYmd(), -7);
}

function getNextRefNoPreview() {
  const year = currentYear();
  const next = (state.counters[year] && state.counters[year].nextRefNo) || 1;
  return `APG-EL-${year}-${String(next).padStart(4, "0")}`;
}

function generateRequestId() {
  return `req-${currentYear()}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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

/* ==========================================
   GROUP REQUESTS (several people, one letter, same reason)
   req.isGroup + req.groupMembers = [{ uid|null, name, internId, position,
   department, memberType, signature }]. The person filing is NOT in
   groupMembers; they stay in req.uid / req.snapshot / req.internSignature.
   ========================================== */
function isGroupRequest(req) {
  return Boolean(req && req.isGroup && Array.isArray(req.groupMembers) && req.groupMembers.length > 0);
}

// Everyone on the letter, person filing first
function getRequestMembers(req) {
  const s = req.snapshot || {};
  const filer = {
    uid: req.uid,
    name: s.name,
    internId: s.internId,
    position: s.position,
    department: s.department,
    memberType: req.memberType,
    signature: req.internSignature,
    isFiler: true
  };
  return isGroupRequest(req) ? [filer, ...req.groupMembers] : [filer];
}

// Everyone on the request who has an account here (used by the duplicate-date guard)
function getRequestUids(req) {
  return [...new Set(getRequestMembers(req).map((m) => m.uid).filter(Boolean))];
}

function requestIncludesUser(req, uid) {
  return Boolean(uid) && getRequestUids(req).includes(uid);
}

// "Juan Dela Cruz" or "Juan Dela Cruz + 2 others"
function formatRequestNames(req) {
  const members = getRequestMembers(req);
  const first = members[0].name || "";
  return members.length === 1 ? first : `${first} + ${members.length - 1} other${members.length > 2 ? "s" : ""}`;
}

// Every name on the request, comma separated (CSV, review screen)
function listRequestNames(req) {
  return getRequestMembers(req).map((m) => m.name || "").join(", ");
}

function computeAllSlotKeys(req) {
  return getRequestUids(req).flatMap((uid) => computeSlotKeysForRequest(uid, req));
}

/**
 * Checks if anyone on the request already has another active (submitted/approved)
 * request covering the same day / half-day.
 */
function checkDuplicateSlots(uid, reqData, ignoreRequestId = null) {
  const keys = computeAllSlotKeys({ ...reqData, uid: reqData.uid || uid });
  for (const key of keys) {
    const existing = state.absenceSlots[key];
    if (existing && existing.requestId !== ignoreRequestId) {
      const otherReq = state.requests[existing.requestId];
      if (otherReq && (otherReq.status === "submitted" || otherReq.status === "approved")) {
        const parts = key.split("_");
        const shiftPart = parts.pop();
        const datePart = parts.pop();
        const personUid = parts.join("_");
        return {
          conflict: true,
          date: datePart,
          shift: shiftPart.toUpperCase(),
          personUid,
          personName: (state.users[personUid] && state.users[personUid].name) || "Someone",
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

  const group = isGroupRequest(req);
  const types = new Set(getRequestMembers(req).map((m) => m.memberType || "intern"));
  const dutyNoun = types.size > 1 ? "duties" : req.memberType === "employee" ? "work duties" : "internship duties";
  const dutyPhrase = `${group ? "our" : "my"} ${dutyNoun}`;
  const lead = group ? "We respectfully request" : "I respectfully request";

  if (req.type === "half") {
    const shiftText = req.shift || "morning";
    const timeRangeText = req.timeRange || (shiftText === "morning" ? "8:00 AM – 12:00 PM" : "1:00 PM – 5:00 PM");
    const dateText = req.date ? formatLongDate(req.date) : "{DATE}";
    return `${lead} permission to be absent from ${dutyPhrase} during the ${wrap(shiftText)} shift (${wrap(timeRangeText)}) of ${wrap(dateText)}.`;
  }

  if (req.type === "multi") {
    const startText = req.startDate ? formatLongDate(req.startDate) : "{START_DATE}";
    const endText = req.endDate ? formatLongDate(req.endDate) : "{END_DATE}";
    const nDays = req.startDate && req.endDate ? countWeekdaysBetween(req.startDate, req.endDate) : (req.days || "{N}");
    return `${lead} permission to be absent from ${dutyPhrase} from ${wrap(startText)} to ${wrap(endText)} (${wrap(nDays + (nDays === 1 ? " day" : " days"))}).`;
  }

  // Default: Full-day
  const dateText = req.date ? formatLongDate(req.date) : "{DATE}";
  return `${lead} permission to be absent from ${dutyPhrase} on ${wrap(dateText)}.`;
}

// Only allow inline image data (drawn/uploaded signatures, photos) as <img> sources
function safeImageSrc(src) {
  return typeof src === "string" && /^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(src) ? src : "";
}

// What appears above the member's name on the letter, depending on how they signed
function renderMemberSignatureSlot(req, options = {}) {
  if (options.blankSignature) return ""; // printed copy for signing by hand
  const method = req.signatureMethod || "digital";
  if (method === "wet-upload") {
    return `<span class="a4-wet-note">Signed by hand · photo of signed letter on file with HR</span>`;
  }
  if (method === "wet-paper") {
    const received = req.paperCopy && req.paperCopy.status === "received";
    return `<span class="a4-wet-note">Signed by hand · paper copy ${received ? "received by HR" : "to be handed in to HR"}</span>`;
  }
  const src = safeImageSrc(req.internSignature);
  return src
    ? `<img src="${src}" alt="Member Signature" />`
    : `<span class="a4-sig-space-placeholder">[Signature required]</span>`;
}

// Signature area for one person on a group letter
function renderGroupMemberSignatureSlot(req, member, options = {}) {
  if (options.blankSignature) return "";
  const method = req.signatureMethod || "digital";
  if (method !== "digital") return `<span class="a4-wet-note">Signed by hand</span>`;
  const src = safeImageSrc(member.signature);
  return src
    ? `<img src="${src}" alt="Signature of ${escapeHtml(member.name || "")}" />`
    : `<span class="a4-sig-space-placeholder">[Signature required]</span>`;
}

// Group letter: everyone signs in a 3-column grid, HR signs in the next cell
function renderGroupSignaturesHTML(req, letterSettings, options, hrSigToRender, isApproved) {
  const cells = getRequestMembers(req)
    .map(
      (m) => `
        <div class="a4-group-sig">
          <div class="a4-sig-space">${renderGroupMemberSignatureSlot(req, m, options)}</div>
          <div class="a4-person-name">${escapeHtml(m.name || "[Name]")}</div>
          <div class="a4-person-title">${escapeHtml(m.position || "")}</div>
        </div>`
    )
    .join("");
  const hrPlaceholder = isApproved || options.blankSignature ? "" : "[Signed by HR on approval]";
  return `
    <div class="a4-group-signatures">
      <div class="a4-sig-greeting">Sincerely,</div>
      <div class="a4-group-sig-grid">
        ${cells}
        <div class="a4-group-sig a4-group-sig-hr">
          <div class="a4-sig-space">
            ${hrSigToRender ? `<img src="${hrSigToRender}" alt="HR Officer Signature" />` : `<span class="a4-sig-space-placeholder">${hrPlaceholder}</span>`}
          </div>
          <div class="a4-person-name">${escapeHtml(letterSettings.signatoryName)}</div>
          <div class="a4-person-title">${escapeHtml(letterSettings.signatoryTitle)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderLockedLetterHTML(req, letterSettings = state.settings.letter, options = {}) {
  const highlightVars = options.highlightVars !== false;
  const filingDateStr = formatStandardDate(
    (req.submittedAt || req.createdAt || todayYmd()).slice(0, 10)
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
  // Decision: Final PDF/print output is strictly a clean official letter without the approved stamp
  if (!options.cleanPdf) {
    if (isApproved) {
      const approvedDate = req.review && req.review.at ? formatShortDate(req.review.at) : filingDateStr;
      topStampHTML = `
        <div class="a4-approval-stamp">
          <div class="a4-approval-stamp-title">✓ APPROVED</div>
          <div class="a4-approval-stamp-ref">REF: ${escapeHtml(req.refNo || `APG-EL-${currentYear()}-XXXX`)}</div>
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
        <p class="a4-body-p">${escapeHtml(isGroupRequest(req) ? letterSettings.apologyParagraphGroup || DEFAULT_GROUP_APOLOGY : letterSettings.apologyParagraph)}</p>

        <!-- 4th Paragraph: Closing Appreciation -->
        <p class="a4-body-p">${escapeHtml(isGroupRequest(req) ? letterSettings.thankYouParagraphGroup || DEFAULT_GROUP_THANKS : letterSettings.thankYouParagraph)}</p>

        ${isGroupRequest(req) ? renderGroupSignaturesHTML(req, letterSettings, options, hrSigToRender, isApproved) : `
        <!-- Dual Signature Section Matching Exact Template Layout -->
        <div class="a4-signatures-row">
          <!-- Intern Signature Column (Left) -->
          <div class="a4-sig-col">
            <div class="a4-sig-greeting">Sincerely,</div>
            <div class="a4-sig-space">
              ${renderMemberSignatureSlot(req, options)}
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
                  : `<span class="a4-sig-space-placeholder">${isApproved || options.blankSignature ? "" : "[Stamped automatically upon HR Approval]"}</span>`
              }
            </div>
            <div class="a4-person-name">${escapeHtml(letterSettings.signatoryName)}</div>
            <div class="a4-person-title">${escapeHtml(letterSettings.signatoryTitle)}</div>
          </div>
        </div>`}
      </div>
    </div>
  `;
}

/* ==========================================
   OFFICIAL A4 PRINT & PDF GENERATOR
   Mounts the clean letterhead sheet into the dedicated
   print mount so native browser print / save-as-pdf
   renders strictly 1 page of the official letter
   ========================================== */
function downloadRequestPDF(requestId) {
  const req = state.requests[requestId];
  if (!req) return;
  printLetter(req);
}

// Mounts the clean official letter into the dedicated print container and opens
// the browser's print dialog (print or "Save as PDF"). extraOptions is passed to the
// letter renderer, e.g. { blankSignature: true } for a copy to sign by hand.
function printLetter(req, extraOptions = {}) {
  let mount = document.getElementById("print-letter-mount");
  if (!mount) {
    mount = document.createElement("div");
    mount.id = "print-letter-mount";
    document.body.appendChild(mount);
  }

  mount.innerHTML = renderLockedLetterHTML(req, state.settings.letter, {
    highlightVars: false,
    cleanPdf: true,
    elementId: "print-active-sheet",
    ...extraOptions
  });

  showToast(`Preparing official letter ready to print (${req.refNo || req.id})...`);

  // Small timeout to allow images and signatures to decode cleanly before opening the print preview
  setTimeout(() => {
    window.print();
  }, 100);
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

// Small tag under the status for hand-signed letters that must be handed in to HR
function renderPaperCopyTag(r) {
  if (r.signatureMethod !== "wet-paper" || r.status !== "submitted") return "";
  const received = r.paperCopy && r.paperCopy.status === "received";
  return `<div style="font-size:11px; margin-top:4px; color:${received ? "#4ade80" : "#fb923c"};">📄 ${received ? "Paper copy received" : "Waiting for paper copy"}</div>`;
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

/* ==========================================
   ROLE / DEMO SWITCHER & NAVIGATION
   ========================================== */
const AUTH_SCREENS = ["home", "member-login", "admin-login"];

// Demo bar (persona switcher) is for local testing.
// Enabled by default in prototype / local file / test mode, or toggle with `showDemoBar` in firebase-config.js.
function isDemoMode() {
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get("demo") === "1" || p.get("demo") === "true") return true;
    if (p.get("demo") === "0" || p.get("demo") === "false") return false;
  } catch (e) {
    /* ignore */
  }
  if (window.APG_FIREBASE_CONFIG && typeof window.APG_FIREBASE_CONFIG.showDemoBar === "boolean") {
    return window.APG_FIREBASE_CONFIG.showDemoBar;
  }
  return true;
}

// Landing screen after sign-in: HR goes to the review queue, members go straight to the form.
function getHomeScreenForUser(u) {
  if (!u) return "home";
  if (u.role === "hr") return "hr-queue";
  if (u.status !== "active") return "intern-dashboard";
  return "new-request";
}

function signInAs(uid) {
  const u = state.users[uid];
  if (!u) return;
  state.currentUserUid = uid;
  state.currentScreen = getHomeScreenForUser(u);
  state.editingRequestId = null;
  saveState();
  renderApp();
}

function switchDemoAccount(uidOrAuth) {
  if (uidOrAuth === "auth-screen") {
    state.currentUserUid = null;
    state.currentScreen = "home";
    state.editingRequestId = null;
    saveState();
    renderApp();
    return;
  }
  signInAs(uidOrAuth);
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
  const pendingAccountsCount = Object.values(state.users).filter((u) => u.role !== "hr" && u.status === "pending").length;
  const returnedCountForIntern = currentUser
    ? Object.values(state.requests).filter((r) => r.uid === currentUser.uid && r.status === "returned").length
    : 0;

  // Top Demo / Role Switcher Bar (local testing only)
  const demoBarHTML = !isDemoMode() ? "" : `
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
        ${[
          ["intern-john", "John"],
          ["intern-mark", "Mark"],
          ["intern-kevs", "Kevs"]
        ]
          .map(
            ([uid, label]) => `<button class="demo-switcher-btn ${state.currentUserUid === uid ? "active" : ""}" onclick="switchDemoAccount('${uid}')">🎓 Intern: ${label}</button>`
          )
          .join("")}
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
          🏠 Home (Signed Out)
        </button>
      </div>
      <div>
        <button class="demo-switcher-btn" onclick="resetDemoState()">↺ Reset Seed Data</button>
      </div>
    </div>
  `;

  // Signed out: Home → Member sign-in (answer form) or Admin sign-in
  if (!currentUser) {
    if (!AUTH_SCREENS.includes(state.currentScreen)) state.currentScreen = "home";
    const screenHTML =
      state.currentScreen === "member-login"
        ? renderLoginScreen("member")
        : state.currentScreen === "admin-login"
        ? renderLoginScreen("admin")
        : renderHomeScreen();
    root.innerHTML = demoBarHTML + screenHTML;
    return;
  }

  // Signed in but on a signed-out screen (e.g. after reload): go to their landing screen
  if (AUTH_SCREENS.includes(state.currentScreen) || state.currentScreen === "login") {
    state.currentScreen = getHomeScreenForUser(currentUser);
  }
  // Members cannot open HR screens and HR cannot open member screens
  const isHRScreen = String(state.currentScreen).startsWith("hr-");
  if ((currentUser.role === "hr") !== isHRScreen) {
    state.currentScreen = getHomeScreenForUser(currentUser);
  }

  // Sidebar Items based on Role
  let navItemsHTML = "";
  if (currentUser.role === "intern" || currentUser.role === "employee") {
    navItemsHTML = `
      <div class="nav-section-label">${currentUser.role === "employee" ? "Employee Portal" : "Intern Portal"}</div>
      <ul class="nav-list">
        <li class="nav-item ${state.currentScreen === "intern-dashboard" ? "active" : ""}" onclick="navigateTo('intern-dashboard')" title="Dashboard">
          <div class="nav-item-content">
            <span class="nav-icon">📊</span>
            <span class="nav-label">Dashboard</span>
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
        <li class="nav-item ${state.currentScreen === "hr-calendar" ? "active" : ""}" onclick="navigateTo('hr-calendar')" title="Absence Calendar">
          <div class="nav-item-content">
            <span class="nav-icon">📅</span>
            <span class="nav-label">Calendar</span>
          </div>
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
  if (currentUser.role !== "hr" && currentUser.status !== "active") {
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

        <ul class="nav-list nav-list-signout">
          <li class="nav-item" onclick="signOut()" title="Sign Out">
            <div class="nav-item-content">
              <span class="nav-icon">🚪</span>
              <span class="nav-label">Sign Out</span>
            </div>
          </li>
        </ul>

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
function renderHomeScreen() {
  return `
    <div class="auth-bg">
      <div class="card home-card">
        <div class="auth-brand">
          <div class="brand-emblem">AP</div>
          <div>
            <div class="auth-brand-title">ALPHA PREMIER GROUP</div>
            <div class="auth-brand-sub">Leave of Absence Portal</div>
          </div>
        </div>

        <h1 class="home-title">Leave of Absence Request</h1>
        <p class="home-sub">Choose how you want to continue.</p>

        <!-- Quick 1-Click Demo Buttons for Testing PDF & Formatting -->
        <div class="demo-quick-banner" style="margin-bottom: 22px; padding: 14px 18px; background: rgba(212, 163, 67, 0.08); border: 1px solid rgba(212, 163, 67, 0.35); border-radius: 12px; text-align: left;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gold-primary); font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>⚡ QUICK DEMO ACCESS (1-CLICK TEST)</span>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 10px 0;">
            Instantly test the PDF export, letter margin formatting, and live preview without manual sign-up:
          </p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="btn btn-gold" style="font-size: 12px; padding: 8px 16px; cursor: pointer;" onclick="signInAs('intern-juan')">
              👨‍💼 Test as Active Intern (Juan Dela Cruz)
            </button>
            <button type="button" class="btn btn-outline" style="font-size: 12px; padding: 8px 16px; cursor: pointer;" onclick="signInAs('hr-chico')">
              🛡️ Test as HR Admin (Jean Ashley Chico)
            </button>
          </div>
        </div>

        <div class="home-options">
          <button type="button" class="home-option" onclick="navigateTo('member-login')">
            <span class="home-option-icon">📝</span>
            <span class="home-option-title">Answer Absence Form</span>
            <span class="home-option-desc">For interns and employees. Sign in or register, then fill out and submit your absence letter to HR.</span>
          </button>
          <button type="button" class="home-option home-option-admin" onclick="navigateTo('admin-login')">
            <span class="home-option-icon">🛡️</span>
            <span class="home-option-title">Login as Admin</span>
            <span class="home-option-desc">For HR and owners. Review, approve, return or decline submitted forms.</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function fillDemoCredentials(mode = "member") {
  const emailInput = document.getElementById("login-email");
  const passInput = document.getElementById("login-pass");
  const account = getTempAccounts().find((a) => a.role === (mode === "admin" ? "hr" : "intern"));
  if (emailInput && passInput && account) {
    emailInput.value = account.email;
    passInput.value = account.password;
  }
}

function renderLoginScreen(mode = "member") {
  const isAdmin = mode === "admin";
  const signInCard = `
    <div class="auth-pane">
      <button type="button" class="auth-back" onclick="navigateTo('home')">← Back</button>
      <div class="auth-brand">
        <div class="brand-emblem">AP</div>
        <div>
          <div class="auth-brand-title">ALPHA PREMIER GROUP</div>
          <div class="auth-brand-sub">${isAdmin ? "Admin / HR Access" : "Leave of Absence Portal"}</div>
        </div>
      </div>

      <h2 class="auth-heading">${isAdmin ? "Admin Sign In" : "Sign In to Answer the Form"}</h2>
      <p class="auth-text">
        ${isAdmin ? "Only HR officers and owners can sign in here." : "Interns and employees sign in with their registered email."}
      </p>

      <!-- 1-Click Demo Shortcut -->
      <div style="margin-bottom: 16px; padding: 12px 14px; background: rgba(212, 163, 67, 0.08); border: 1px solid rgba(212, 163, 67, 0.28); border-radius: 9px; font-size: 12px;">
        <div style="font-weight: 700; color: var(--gold-primary); margin-bottom: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;">
          ⚡ Instant Demo Access:
        </div>
        ${
          !isAdmin
            ? `
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
            <button type="button" class="btn btn-gold" style="font-size:11.5px; padding:6px 12px;" onclick="signInAs('intern-juan')">
              👨‍💼 Enter as Intern (Juan Dela Cruz)
            </button>
            <button type="button" class="btn btn-outline" style="font-size:11.5px; padding:6px 12px;" onclick="fillDemoCredentials('member')">
              Auto-fill Form
            </button>
          </div>
          <div style="color:var(--text-muted); font-size:11px;">
            Demo email: <strong style="color:var(--text-main);">demo@intern.com</strong> · Auto-fill enters the test password
          </div>
        `
            : `
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
            <button type="button" class="btn btn-gold" style="font-size:11.5px; padding:6px 12px;" onclick="signInAs('hr-chico')">
              🛡️ Enter as HR Admin (Ms. Chico)
            </button>
            <button type="button" class="btn btn-outline" style="font-size:11.5px; padding:6px 12px;" onclick="fillDemoCredentials('admin')">
              Auto-fill Form
            </button>
          </div>
          <div style="color:var(--text-muted); font-size:11px;">
            Admin email: <strong style="color:var(--text-main);">jachico@alphapremier.com</strong> · Auto-fill enters the test password
          </div>
        `
        }
      </div>

      <form onsubmit="handleLoginSubmit(event, '${isAdmin ? "admin" : "member"}')">
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input type="email" id="login-email" class="form-control" autocomplete="username" placeholder="${isAdmin ? "jachico@alphapremier.com" : "demo@intern.com"}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" id="login-pass" class="form-control" autocomplete="current-password" placeholder="Password" required />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Sign In</button>
      </form>
      ${
        isAdmin
          ? `<p class="auth-switch">Not an admin? <a href="#" onclick="navigateTo('member-login'); return false;">Go to the absence form</a></p>`
          : `<p class="auth-switch">HR or owner? <a href="#" onclick="navigateTo('admin-login'); return false;">Admin sign in</a></p>`
      }
    </div>
  `;

  const registerCard = isAdmin
    ? ""
    : `
    <div class="auth-pane auth-pane-alt">
      <h2 class="auth-heading">New here? Register</h2>
      <p class="auth-text">
        New accounts start as <span class="status-pill status-submitted">pending</span>. HR confirms who you are, then activates your account and sets your official ID number, position and department before you can file a request.
      </p>

      <form onsubmit="handleSelfRegisterSubmit(event)">
        <div class="form-group">
          <label class="form-label">I am an *</label>
          <select id="reg-type" class="form-control" required>
            <option value="intern">Intern</option>
            <option value="employee">Employee</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Full Name (as it should appear on the letter) *</label>
          <input type="text" id="reg-name" class="form-control" placeholder="e.g., Carlos Miguel Villanueva" required />
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" id="reg-email" class="form-control" placeholder="name@example.com" autocomplete="username" required />
        </div>
        <div class="form-group">
          <label class="form-label">Password *</label>
          <input type="password" id="reg-pass" class="form-control" placeholder="Minimum 8 characters" minlength="8" autocomplete="new-password" required />
        </div>
        <button type="submit" class="btn btn-gold" style="width:100%;">Register</button>
      </form>
    </div>
  `;

  return `
    <div class="auth-bg">
      <div class="card auth-card ${isAdmin ? "auth-card-single" : ""}">
        ${signInCard}
        ${registerCard}
      </div>
    </div>
  `;
}

/* ==========================================
   TEMPORARY LOGIN (until Firebase Auth is connected)
   - The HR and intern test accounts in temp-login.js are checked directly.
   - Self-registered accounts store a SHA-256 hash of their password in this
     browser only. Firebase Auth will replace all of this.
   ========================================== */
function getTempAccounts() {
  return Array.isArray(window.APG_TEMP_ACCOUNTS) ? window.APG_TEMP_ACCOUNTS : [];
}

async function hashPassword(password) {
  if (window.crypto && window.crypto.subtle && window.TextEncoder) {
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    return "sha256:" + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback for browsers without Web Crypto (e.g. pages opened from file://)
  let h = 0x811c9dc5;
  for (const ch of password) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "fnv:" + h.toString(16);
}

async function verifyPassword(user, password) {
  const temp = getTempAccounts().find((a) => a.uid === user.uid);
  if (temp) return password === temp.password;
  if (!user.passwordHash) return false; // sample accounts without a password cannot sign in
  return (await hashPassword(password)) === user.passwordHash;
}

async function handleLoginSubmit(e, mode = "member") {
  e.preventDefault();
  let email = (document.getElementById("login-email").value || "").trim().toLowerCase();
  const password = document.getElementById("login-pass").value;

  // Demo shortcuts: typing "demo"/"intern" or "admin"/"hr" picks the test account,
  // but the test password from temp-login.js is still required.
  const memberAliases = ["demo", "intern", "demo@intern.com", "intern@demo.com"];
  const adminAliases = ["admin", "hr", "demo@admin.com", "admin@demo.com"];
  const aliasRole = mode === "member" && memberAliases.includes(email) ? "intern" : mode === "admin" && adminAliases.includes(email) ? "hr" : null;
  const aliasAccount = aliasRole && getTempAccounts().find((a) => a.role === aliasRole);
  if (aliasAccount) email = aliasAccount.email.toLowerCase();

  const temp = getTempAccounts().find((a) => (a.email || "").toLowerCase() === email);
  const found = temp
    ? state.users[temp.uid]
    : Object.values(state.users).find((u) => (u.email || "").toLowerCase() === email);

  // Same message for unknown email and wrong password, so emails can't be guessed
  if (!found || !(await verifyPassword(found, password))) {
    showToast("Incorrect email or password.");
    return;
  }
  if (mode === "admin" && found.role !== "hr") {
    showToast("This account is not an admin. Use “Answer Absence Form” instead.");
    return;
  }
  if (mode === "member" && found.role === "hr") {
    showToast("Admin accounts sign in through “Login as Admin”.");
    return;
  }
  if (found.status === "disabled") {
    showToast("This account has been disabled. Please contact HR.");
    return;
  }
  signInAs(found.uid);
  showToast(`Signed in as ${found.name}`);
}

async function handleSelfRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-pass").value;
  const memberType = document.getElementById("reg-type").value === "employee" ? "employee" : "intern";
  if (!name || !email) return;
  if (password.length < 8) {
    showToast("Password must be at least 8 characters.");
    return;
  }

  const emailTaken =
    Object.values(state.users).some((u) => (u.email || "").toLowerCase() === email.toLowerCase()) ||
    getTempAccounts().some((a) => (a.email || "").toLowerCase() === email.toLowerCase());
  if (emailTaken) {
    showToast("An account with that email already exists. Please sign in instead.");
    return;
  }
  const passwordHash = await hashPassword(password);

  const uid = `${memberType}-${Date.now()}`;
  state.users[uid] = {
    uid,
    name,
    email,
    internId: "",
    position: "",
    department: "",
    role: memberType,
    memberType,
    status: "pending",
    requiredHours: memberType === "intern" ? 480 : 0,
    renderedHours: 0,
    savedSignature: "",
    passwordHash, // TEMPORARY: removed once Firebase Auth handles passwords
    createdAt: new Date().toISOString()
  };
  state.currentUserUid = uid;
  state.currentScreen = "intern-dashboard";
  saveState();
  showToast("Account created. HR must activate it before you can file a request.");
  renderApp();
}

function signOut() {
  state.currentUserUid = null;
  state.currentScreen = "home";
  state.editingRequestId = null;
  saveState();
  renderApp();
  showToast("Signed out.");
}

function renderPendingInternScreen(user) {
  return `
    <div class="card" style="max-width:680px; margin:40px auto; text-align:center; padding:36px;">
      <div style="font-size:44px; margin-bottom:12px;">⏳</div>
      <h2 class="page-title">Account Pending HR Activation</h2>
      <p style="color:var(--text-muted); margin:12px 0 20px; font-size:14.5px;">
        Welcome, <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}).<br/>
        To ensure every official Alpha Premier letter uses standardized titles and IDs (preventing typos like <em>"MarketingAssociate"</em>), HR must activate your account and assign your <strong>ID Number</strong>, <strong>Official Position</strong>, and <strong>Department</strong> before you can file excuse letters.
      </p>
      <div style="background:var(--apg-surface-elevated); border:1px solid var(--border); padding:16px; border-radius:8px; text-align:left; font-size:13px; margin-bottom:20px;">
        <div><strong>Current Status:</strong> <span class="status-pill status-submitted">Pending HR Activation</span></div>
        <div style="margin-top:6px;">HR will confirm your identity and activate your ${user.role === "employee" ? "employee" : "intern"} account. Sign in again once you're notified.</div>
      </div>
      ${
        isDemoMode()
          ? `<button class="btn btn-primary" onclick="switchDemoAccount('hr-chico'); navigateTo('hr-settings');">
        Test mode: switch to HR to activate this account →
      </button>`
          : `<button class="btn btn-outline" onclick="signOut()">Sign Out</button>`
      }
    </div>
  `;
}

/* ==========================================
   SCREEN 2: INTERN DASHBOARD
   ========================================== */
function renderInternDashboard(user) {
  const myReqs = Object.values(state.requests)
    .filter((r) => requestIncludesUser(r, user.uid))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  const counts = {
    approved: myReqs.filter((r) => r.status === "approved").length,
    submitted: myReqs.filter((r) => r.status === "submitted").length,
    returned: myReqs.filter((r) => r.status === "returned").length,
    draft: myReqs.filter((r) => r.status === "draft").length
  };

  const returnedAlertHTML = counts.returned > 0
    ? `
      <div class="card" style="border-left:5px solid #ea580c; background:rgba(234, 88, 12, 0.12);">
        <div class="card-body" style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
          <div>
            <div style="font-weight:700; color:#fb923c; font-size:14.5px;">🟠 You have ${counts.returned} request returned for revision by HR</div>
            <div style="font-size:13px; color:#fdba74; margin-top:2px;">You can edit the remarks/details and resubmit without filing a brand-new request.</div>
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
        <p class="page-subtitle">Profile: <strong>${escapeHtml(user.name)}</strong> · ${escapeHtml(user.position)} · ID: <code>${escapeHtml(user.internId)}</code></p>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-outline" onclick="navigateTo('hr-calendar')">📅 View Calendar</button>
        <button class="btn btn-primary" onclick="navigateTo('new-request', { editRequestId: null })">
          + New Excuse Letter
        </button>
      </div>
    </div>

    ${returnedAlertHTML}

    <!-- Excuse Letters Overview Stats Grid -->
    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card">
        <div class="stat-label">Total Requests Filed</div>
        <div class="stat-value">${myReqs.length}</div>
        <div class="stat-sub">All-time excuse letters</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #16a34a;">
        <div class="stat-label">Approved Letters</div>
        <div class="stat-value" style="color:#22c55e;">${counts.approved}</div>
        <div class="stat-sub">Signed & stamped by HR</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #eab308;">
        <div class="stat-label">Pending HR Review</div>
        <div class="stat-value" style="color:#fde047;">${counts.submitted}</div>
        <div class="stat-sub">In approval queue</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #ea580c;">
        <div class="stat-label">Returned for Revision</div>
        <div class="stat-value" style="color:#fb923c;">${counts.returned}</div>
        <div class="stat-sub">Edits requested</div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Recent Requests -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 Recent Excuse Letters</span>
          <button class="btn btn-outline btn-sm" onclick="navigateTo('my-requests')">View All (${myReqs.length})</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date(s)</th>
                <th>Absence Type</th>
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
                    <div style="font-size:11.5px; color:var(--text-muted);">${r.shift ? escapeHtml(r.shift) : (r.type === "multi" ? `${r.days} days` : "Full Day")}</div>
                  </td>
                  <td>${renderStatusPill(r.status)}</td>
                  <td>
                    <button class="btn btn-outline btn-sm" onclick="openLetterModal('${r.id}')">Preview</button>
                    ${
                      canEditRequest(r, user)
                        ? `<button class="btn btn-warning btn-sm" onclick="navigateTo('new-request', { editRequestId: '${r.id}' })">${r.status === "submitted" ? "Edit" : "Revise"}</button>`
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
// Only the person who filed a request can edit it, and only before HR decides on it
const EDITABLE_STATUSES = ["draft", "returned", "submitted"];
function canEditRequest(req, user) {
  return Boolean(req && user && req.uid === user.uid && EDITABLE_STATUSES.includes(req.status));
}

function renderNewRequestScreen(user) {
  const candidate = state.editingRequestId ? state.requests[state.editingRequestId] : null;
  const editingReq = canEditRequest(candidate, user) ? candidate : null;
  if (!editingReq) state.editingRequestId = null;
  const isRevise = Boolean(editingReq);
  const isEditingPending = Boolean(editingReq && editingReq.status === "submitted");
  const isGroup = Boolean(editingReq && editingReq.isGroup);

  const defaultDate = addDaysYmd(todayYmd(), 1);
  const initialData = editingReq || {
    type: "full",
    date: defaultDate,
    startDate: defaultDate,
    endDate: addDaysYmd(defaultDate, 1),
    shift: "morning",
    timeRange: "8:00 AM – 12:00 PM",
    reasonCategory: "Academic",
    reasonDetails: "",
    internSignature: user.savedSignature || "",
    signatureMethod: "digital",
    status: "draft"
  };

  // Minimum date allowed: 7 days back from today
  const minDateAllowed = getMinFilingDate();
  const sigMethod = initialData.signatureMethod || "digital";

  const hrRemarksBanner =
    editingReq && editingReq.status === "returned" && editingReq.review
      ? `
      <div class="card" style="border-left:5px solid #ea580c; background:rgba(234, 88, 12, 0.12); margin-bottom:18px;">
        <div class="card-body">
          <div style="font-weight:700; color:#fb923c;">🟠 Returned for Revision by ${escapeHtml(editingReq.review.byName)}</div>
          <div style="font-size:13.5px; color:#fdba74; margin-top:4px;"><strong>HR Remarks:</strong> "${escapeHtml(editingReq.review.remarks)}"</div>
        </div>
      </div>
    `
      : "";

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">${isEditingPending ? `Edit Pending Request (${editingReq.id})` : isRevise ? `Revise Request (${editingReq.id})` : "New Leave of Absence Request"}</h1>
        <p class="page-subtitle">Fill in the variables below. The locked Alpha Premier letter updates in real time on the right.</p>
      </div>
      <button class="btn btn-outline" onclick="navigateTo('my-requests')">← Back to My Requests</button>
    </div>

    ${hrRemarksBanner}
    ${
      isEditingPending
        ? `<div class="card" style="border-left:5px solid var(--apg-gold); margin-bottom:18px;"><div class="card-body" style="font-size:13px;">✏️ This request is still waiting for HR. Your changes replace the version HR sees. Once HR approves, returns or declines it, it can no longer be edited here.</div></div>`
        : ""
    }

    <div class="split-workspace">
      <!-- LEFT COLUMN: VARIABLE INPUT FORM -->
      <div class="card" style="margin-bottom:0;">
        <div class="card-header">
          <span class="card-title">1. Absence Variables</span>
          <span style="font-size:11.5px; color:var(--text-muted);">All wording & layout locked by HR</span>
        </div>
        <div class="card-body">
          <!-- Locked Auto-Filled Profile Snapshot Preview -->
          <div style="background:var(--apg-surface-elevated); border:1px solid var(--border); border-radius:7px; padding:10px 12px; margin-bottom:16px; font-size:12px;">
            <div style="font-weight:700; color:var(--apg-gold); margin-bottom:3px;">🔒 Auto-Snapshotted from Profile:</div>
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

          <!-- Who is absent? Just me, or a group with the same reason -->
          <div class="form-group">
            <label class="form-label">
              <span>Who is absent? *</span>
              <span style="font-weight:400; font-size:11.5px; color:var(--text-light);">Same reason? File one letter for everyone</span>
            </label>
            <div class="radio-pills" id="group-pills">
              <div class="radio-pill ${isGroup ? "" : "active"}" data-group="solo" onclick="setGroupMode(false)">Just me</div>
              <div class="radio-pill ${isGroup ? "active" : ""}" data-group="group" onclick="setGroupMode(true)">Group (same reason)</div>
            </div>
            <input type="hidden" id="f-is-group" value="${isGroup ? "1" : ""}" />
            <div id="group-panel" class="group-panel" style="${isGroup ? "" : "display:none;"}">
              <div class="form-hint" style="margin-bottom:8px;">You are listed first. Add everyone else who will be absent with you (up to ${MAX_GROUP_SIZE} people in total, including you).</div>
              <div id="group-members-list"></div>
              <div class="group-add-row">
                <select id="group-add-select" class="form-control" aria-label="Choose a person to add"></select>
                <button type="button" class="btn btn-outline btn-sm" onclick="addGroupMemberFromSelect()">+ Add</button>
              </div>
              <button type="button" class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="addManualGroupMember()">+ Add someone not in the list</button>
            </div>
          </div>

          <!-- Absence Type -->
          <div class="form-group">
            <label class="form-label">Absence Type *</label>
            <div class="radio-pills" id="type-pills">
              <div class="radio-pill ${initialData.type === "full" ? "active" : ""}" data-type="full" onclick="setFormAbsenceType('full')">Full-day</div>
              <div class="radio-pill ${initialData.type === "half" ? "active" : ""}" data-type="half" onclick="setFormAbsenceType('half')">Half-day</div>
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
            <input type="date" id="f-date" class="form-control" min="${minDateAllowed}" value="${escapeHtml(initialData.date || defaultDate)}" />
          </div>

          <!-- Multi-Day Range Picker -->
          <div id="multi-date-group" style="${initialData.type === "multi" ? "" : "display:none;"}">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;" class="form-group">
              <div>
                <label class="form-label">Start Date *</label>
                <input type="date" id="f-start-date" class="form-control" min="${minDateAllowed}" value="${escapeHtml(initialData.startDate || defaultDate)}" />
              </div>
              <div>
                <label class="form-label">End Date *</label>
                <input type="date" id="f-end-date" class="form-control" min="${minDateAllowed}" value="${escapeHtml(initialData.endDate || defaultDate)}" />
              </div>
            </div>
            <div class="form-hint" id="multi-days-hint" style="margin-top:-8px; margin-bottom:14px; font-weight:600; color:var(--apg-gold);">
              Weekdays (Mon–Fri) counted: 2 days
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
          <div id="duplicate-guard-alert" style="display:none; background:rgba(220, 38, 38, 0.16); border:1px solid rgba(248, 113, 113, 0.4); color:#fca5a5; padding:10px 12px; border-radius:7px; font-size:12.5px; margin-bottom:16px; font-weight:600;"></div>

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
            <div style="background:var(--apg-surface-elevated); border:1px dashed var(--border-strong); padding:8px 12px; border-radius:6px; font-size:11.5px; color:var(--text-light); margin-bottom:16px;">
              📎 <strong>Attachments:</strong> Hidden while <code>settings/letter.attachmentsEnabled</code> is <code>false</code> (Decision #4). HR can toggle this flag on in <strong>HR Settings</strong>.
            </div>
          `
          }

          <!-- Step 2: Signature (Digital or Wet) -->
          <div class="form-group" style="border-top:1px solid var(--border); padding-top:14px;">
            <label class="form-label">
              <span>2. Signature *</span>
              <span style="font-weight:400; font-size:11.5px; color:var(--text-light);">Choose how you will sign</span>
            </label>

            <div class="sig-method-options">
              <div class="sig-method-option ${sigMethod === "digital" ? "active" : ""}" data-method="digital" onclick="setSignatureMethod('digital')" role="radio" aria-checked="${sigMethod === "digital"}" tabindex="0">
                <div>
                  <strong>✍️ Digital signature</strong>
                  <span>Draw or upload your signature here.</span>
                </div>
              </div>
              <div class="sig-method-option ${sigMethod !== "digital" ? "active" : ""}" data-method="wet" onclick="setSignatureMethod('wet')" role="radio" aria-checked="${sigMethod !== "digital"}" tabindex="0">
                <div>
                  <strong>🖊️ Wet signature</strong>
                  <span>Print the letter and sign it by hand with a pen.</span>
                </div>
              </div>
            </div>
            <input type="hidden" id="f-sig-method" value="${escapeHtml(sigMethod)}" />

            <!-- Digital signature panel -->
            <div id="digital-sig-panel" style="${sigMethod === "digital" ? "" : "display:none;"}">
              <div style="display:flex; gap:6px; justify-content:flex-end; margin-bottom:6px;">
                ${
                  user.savedSignature
                    ? `<button type="button" class="btn btn-outline btn-sm" onclick="useSavedProfileSignature()">Use Saved Signature</button>`
                    : ""
                }
                <button type="button" class="btn btn-outline btn-sm" onclick="clearSignaturePad()">Clear Pad</button>
              </div>
              <div class="sig-pad-container">
                <canvas id="intern-sig-canvas" class="sig-canvas" width="400" height="130"></canvas>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:11.5px; color:var(--text-muted); flex-wrap:wrap; gap:8px;">
                  <span>Draw above with mouse/touch OR upload PNG/JPG:</span>
                  <input type="file" id="sig-upload-input" accept="image/png,image/jpeg" style="font-size:11px; max-width:190px;" />
                </div>
              </div>
              <label style="display:flex; align-items:center; gap:6px; font-size:12px; margin-top:8px; cursor:pointer;">
                <input type="checkbox" id="f-save-sig" checked />
                Save this signature to my profile for future requests
              </label>
            </div>
            <input type="hidden" id="f-signature" value="${escapeHtml(initialData.internSignature || "")}" />

            <!-- Wet signature panel -->
            <div id="wet-sig-panel" class="wet-panel" style="${sigMethod === "digital" ? "display:none;" : ""}">
              <ol class="wet-steps">
                <li>Fill out the form above first.</li>
                <li><button type="button" class="btn btn-outline btn-sm" onclick="downloadLetterForWetSigning()">🖨️ Print letter to sign</button></li>
                <li>Print it and sign above your name with a pen.</li>
                <li>Choose how HR will get the signed letter:</li>
              </ol>
              <label style="display:flex; gap:6px; align-items:flex-start; margin-bottom:6px; cursor:pointer;">
                <input type="radio" name="wet-delivery" value="wet-upload" ${sigMethod !== "wet-paper" ? "checked" : ""} onchange="setSignatureMethod('wet-upload')" />
                <span><strong>Upload a photo or scan</strong> of the signed letter</span>
              </label>
              <label style="display:flex; gap:6px; align-items:flex-start; cursor:pointer;">
                <input type="radio" name="wet-delivery" value="wet-paper" ${sigMethod === "wet-paper" ? "checked" : ""} onchange="setSignatureMethod('wet-paper')" />
                <span><strong>Hand in the paper copy</strong> to HR</span>
              </label>

              <div id="wet-upload-group" style="margin-top:10px; ${sigMethod === "wet-paper" ? "display:none;" : ""}">
                <input type="file" id="wet-upload-input" accept="image/*" class="form-control" />
                <div class="form-hint">Take a clear photo of the whole page. Large photos are shrunk automatically.</div>
                <img id="wet-copy-preview" class="wet-copy-preview" alt="Signed letter preview" ${initialData.wetCopyImage ? `src="${initialData.wetCopyImage}"` : `style="display:none;"`} />
              </div>
              <div id="wet-paper-group" class="form-hint" style="margin-top:10px; ${sigMethod === "wet-paper" ? "" : "display:none;"}">
                Submit this form now, then give the signed paper to HR. HR can approve your request once they receive the paper copy.
              </div>
            </div>
            <input type="hidden" id="f-wet-copy" value="${escapeHtml(initialData.wetCopyImage || "")}" />
          </div>

          <!-- Submit / Save Draft Actions -->
          <div style="display:flex; gap:10px; margin-top:20px;">
            ${
              isEditingPending
                ? ""
                : `<button type="button" class="btn btn-outline" style="flex:1;" onclick="saveOrSubmitRequest('draft')">
              📝 Save as Draft
            </button>`
            }
            <button type="button" id="btn-submit-req" class="btn btn-primary" style="flex:2;" onclick="saveOrSubmitRequest('submitted')">
              ${isEditingPending ? "💾 Save Changes" : "🚀 Sign & Submit Official Letter"}
            </button>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: LIVE LOCKED A4 LETTERHEAD PREVIEW -->
      <div class="preview-sticky">
        <div class="preview-toolbar">
          <span>📄 <strong>LIVE A4 LETTERHEAD PREVIEW</strong> — Locked Company Format</span>
          <div style="display:flex; gap:8px; align-items:center;">
            <button type="button" class="btn btn-gold btn-sm" style="font-size:11px; padding:3px 10px;" onclick="printCurrentDraftLetter()">🖨️ Test Print / PDF</button>
            <span style="color:#fde68a;">Gold highlights = Variables</span>
          </div>
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

/* ==========================================
   GROUP MEMBERS EDITOR (New Request form)
   ========================================== */
let formGroupMembers = [];

function isFormGroupMode() {
  return document.getElementById("f-is-group")?.value === "1";
}

function setGroupMode(on) {
  const input = document.getElementById("f-is-group");
  if (!input) return;
  input.value = on ? "1" : "";
  document.querySelectorAll("#group-pills .radio-pill").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-group") === (on ? "group" : "solo"));
  });
  document.getElementById("group-panel").style.display = on ? "" : "none";
  renderGroupMembersEditor();
  updateLiveLetterPreview();
}

// Active interns/employees who can be added (not you, not already added)
function getAddableGroupMembers() {
  const me = getCurrentUser();
  const taken = new Set(formGroupMembers.map((m) => m.uid).filter(Boolean));
  return Object.entries(state.users)
    .filter(([key, u]) => key === u.uid) // skip alias entries
    .map(([, u]) => u)
    .filter((u) => (u.role === "intern" || u.role === "employee") && u.status === "active")
    .filter((u) => u.uid !== me.uid && !taken.has(u.uid))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

function groupIsFull() {
  return formGroupMembers.length + 1 >= MAX_GROUP_SIZE;
}

function addGroupMemberFromSelect() {
  const select = document.getElementById("group-add-select");
  const u = select && state.users[select.value];
  if (!u) {
    showToast("Choose a person from the list first.");
    return;
  }
  if (groupIsFull()) {
    showToast(`A group letter can have at most ${MAX_GROUP_SIZE} people.`);
    return;
  }
  formGroupMembers.push({
    uid: u.uid,
    name: u.name,
    internId: u.internId || "",
    position: u.position || "",
    department: u.department || "",
    memberType: u.memberType || (u.role === "employee" ? "employee" : "intern"),
    signature: ""
  });
  renderGroupMembersEditor();
  updateLiveLetterPreview();
}

function addManualGroupMember() {
  if (groupIsFull()) {
    showToast(`A group letter can have at most ${MAX_GROUP_SIZE} people.`);
    return;
  }
  formGroupMembers.push({
    uid: null,
    name: "",
    internId: "",
    position: "",
    department: "",
    memberType: document.getElementById("f-member-type")?.value || "intern",
    signature: ""
  });
  renderGroupMembersEditor();
  updateLiveLetterPreview();
  const inputs = document.querySelectorAll('#group-members-list [data-field="name"]');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function removeGroupMember(index) {
  formGroupMembers.splice(index, 1);
  renderGroupMembersEditor();
  updateLiveLetterPreview();
}

function updateGroupMemberField(index, field, value) {
  if (!formGroupMembers[index]) return;
  formGroupMembers[index][field] = value;
  updateLiveLetterPreview();
}

function clearGroupMemberSignature(index) {
  if (!formGroupMembers[index]) return;
  formGroupMembers[index].signature = "";
  renderGroupMembersEditor();
  updateLiveLetterPreview();
}

function renderGroupMembersEditor() {
  const list = document.getElementById("group-members-list");
  if (!list) return;
  const digital = (document.getElementById("f-sig-method")?.value || "digital") === "digital";

  list.innerHTML = formGroupMembers.length
    ? formGroupMembers
        .map(
          (m, i) => `
      <div class="group-member-card">
        <div class="group-member-head">
          <div class="group-member-info">
            ${
              m.uid
                ? `<strong>${escapeHtml(m.name)}</strong>
                   <div class="group-member-sub">${escapeHtml(m.position || "—")}${m.internId ? ` · <code>${escapeHtml(m.internId)}</code>` : ""}</div>`
                : `<div class="group-manual-fields">
                     <input type="text" class="form-control" data-field="name" placeholder="Full name *" value="${escapeHtml(m.name)}" oninput="updateGroupMemberField(${i}, 'name', this.value)" />
                     <input type="text" class="form-control" placeholder="ID number (optional)" value="${escapeHtml(m.internId)}" oninput="updateGroupMemberField(${i}, 'internId', this.value)" />
                     <input type="text" class="form-control" placeholder="Position" value="${escapeHtml(m.position)}" oninput="updateGroupMemberField(${i}, 'position', this.value)" />
                   </div>`
            }
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="removeGroupMember(${i})" aria-label="Remove ${escapeHtml(m.name || "this person")}">✕ Remove</button>
        </div>
        ${
          digital
            ? `<div class="group-member-sig">
                 <canvas class="sig-canvas group-sig-canvas" data-index="${i}" width="400" height="110" aria-label="Signature pad for ${escapeHtml(m.name || "this person")}"></canvas>
                 <div class="group-member-sig-actions">
                   <span>${m.signature ? "✓ Signed" : `${escapeHtml(m.name || "This person")} signs above`}</span>
                   <button type="button" class="btn btn-outline btn-sm" onclick="clearGroupMemberSignature(${i})">Clear</button>
                 </div>
               </div>`
            : ""
        }
      </div>`
        )
        .join("")
    : `<div class="group-empty">No one added yet.</div>`;

  list.querySelectorAll(".group-sig-canvas").forEach((canvas) => {
    const i = Number(canvas.getAttribute("data-index"));
    attachSignaturePad(canvas, formGroupMembers[i].signature, (dataUrl) => {
      if (!formGroupMembers[i]) return;
      formGroupMembers[i].signature = dataUrl;
      const label = canvas.parentElement.querySelector(".group-member-sig-actions span");
      if (label) label.textContent = "✓ Signed";
      updateLiveLetterPreview();
    });
  });

  const select = document.getElementById("group-add-select");
  if (select) {
    const options = getAddableGroupMembers();
    select.innerHTML =
      `<option value="">${options.length ? "Choose an intern or employee…" : "Everyone in the list is already added"}</option>` +
      options
        .map((u) => `<option value="${escapeHtml(u.uid)}">${escapeHtml(u.name)} — ${escapeHtml(u.position || u.role)}</option>`)
        .join("");
  }
}

// Small drawing pad (mouse, pen or touch). onDone receives a PNG data URL after each stroke.
function attachSignaturePad(canvas, existing, onDone) {
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#0c2340";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  if (existing) {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    img.src = existing;
  }
  let drawing = false;
  const pos = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    };
  };
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    drawing = true;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* pointer already released; drawing still works without capture */
    }
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    onDone(canvas.toDataURL("image/png"));
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
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
  const signatureMethod = document.getElementById("f-sig-method")?.value || "digital";
  const internSignature = signatureMethod === "digital" ? document.getElementById("f-signature")?.value || "" : "";
  const wetCopyImage = signatureMethod === "wet-upload" ? document.getElementById("f-wet-copy")?.value || "" : "";
  const isGroup = isFormGroupMode();
  const groupMembers = isGroup
    ? formGroupMembers.map((m) => ({
        ...m,
        name: (m.name || "").trim(),
        internId: (m.internId || "").trim(),
        position: (m.position || "").trim(),
        signature: signatureMethod === "digital" ? m.signature || "" : ""
      }))
    : [];

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
    signatureMethod,
    internSignature,
    wetCopyImage,
    isGroup: isGroup && groupMembers.length > 0,
    groupMembers,
    status: "draft",
    createdAt: new Date().toISOString()
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
    multiHint.textContent = `Weekdays (Mon–Fri) counted: ${draftObj.days} weekday(s)`;
  }

  // Check duplicate slot guard live
  const dupAlert = document.getElementById("duplicate-guard-alert");
  if (dupAlert) {
    const dup = checkDuplicateSlots(draftObj.uid, draftObj, state.editingRequestId);
    if (dup.conflict) {
      dupAlert.style.display = "block";
      const who = dup.personUid === draftObj.uid ? "You already have" : `${escapeHtml(dup.personName)} already has`;
      dupAlert.innerHTML = `⚠️ <strong>Duplicate Absence Guard:</strong> ${who} an active (${escapeHtml(dup.existingRequest.status)}) request covering <strong>${formatShortDate(dup.date)} (${dup.shift})</strong>.`;
    } else {
      dupAlert.style.display = "none";
    }
  }

  stage.innerHTML = renderLockedLetterHTML(draftObj, state.settings.letter, { highlightVars: true });
}

function initNewRequestInteractivity() {
  const editing = state.editingRequestId ? state.requests[state.editingRequestId] : null;
  formGroupMembers = editing && Array.isArray(editing.groupMembers) ? editing.groupMembers.map((m) => ({ ...m })) : [];
  renderGroupMembersEditor();

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

  // Wet signature: photo/scan of the hand-signed letter
  const wetInput = document.getElementById("wet-upload-input");
  if (wetInput) {
    wetInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        showToast("Preparing your signed letter photo...");
        const dataUrl = await compressImageFile(file);
        document.getElementById("f-wet-copy").value = dataUrl;
        const preview = document.getElementById("wet-copy-preview");
        if (preview) {
          preview.src = dataUrl;
          preview.style.display = "block";
        }
        updateLiveLetterPreview();
        showToast("Signed letter photo attached.");
      } catch (err) {
        e.target.value = "";
        showToast(err.message);
      }
    });
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

/* ==========================================
   SIGNATURE METHOD: DIGITAL OR WET
   digital    → drawn/uploaded signature image placed on the letter
   wet-upload → member prints, signs by hand, uploads a photo/scan
   wet-paper  → member prints, signs by hand, hands the paper to HR
   ========================================== */
function setSignatureMethod(method) {
  const methodInput = document.getElementById("f-sig-method");
  if (!methodInput) return;

  let next = method;
  if (method === "wet") {
    // Keep the previously chosen wet delivery option, default to upload
    const checked = document.querySelector('input[name="wet-delivery"]:checked');
    next = checked ? checked.value : "wet-upload";
  }
  methodInput.value = next;

  const isDigital = next === "digital";
  document.querySelectorAll(".sig-method-option").forEach((el) => {
    const active = el.getAttribute("data-method") === (isDigital ? "digital" : "wet");
    el.classList.toggle("active", active);
    el.setAttribute("aria-checked", String(active));
  });
  document.getElementById("digital-sig-panel").style.display = isDigital ? "" : "none";
  document.getElementById("wet-sig-panel").style.display = isDigital ? "none" : "";
  document.getElementById("wet-upload-group").style.display = next === "wet-upload" ? "" : "none";
  document.getElementById("wet-paper-group").style.display = next === "wet-paper" ? "" : "none";

  renderGroupMembersEditor();
  updateLiveLetterPreview();
}

// Shrinks a photo so it fits comfortably inside one Firestore document (1 MB limit)
function compressImageFile(file, maxDim = 1600, maxChars = 700000) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file (JPG or PNG)."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That image could not be opened."));
      img.onload = () => {
        let dim = maxDim;
        let quality = 0.75;
        for (let attempt = 0; attempt < 6; attempt++) {
          const scale = Math.min(1, dim / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          if (dataUrl.length <= maxChars) {
            resolve(dataUrl);
            return;
          }
          dim = Math.round(dim * 0.8);
          quality = Math.max(0.5, quality - 0.07);
        }
        reject(new Error("That photo is too large even after shrinking. Try a smaller or clearer photo."));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Opens the print dialog for the live draft letter (or save-as-PDF)
function printCurrentDraftLetter() {
  const draft = gatherDraftFormObject();
  if (!draft) return;
  printLetter(draft);
}

// Opens the print dialog for the filled-in letter with an empty signature space, ready to sign by hand
function downloadLetterForWetSigning() {
  const draft = gatherDraftFormObject();
  const hasDate = draft.type === "multi" ? draft.startDate && draft.endDate : draft.date;
  if (!hasDate || draft.reasonDetails.trim().length < 30) {
    showToast("Fill in the date(s) and a reason of at least 30 characters before printing.");
    return;
  }
  const printable = {
    ...draft,
    internSignature: "",
    groupMembers: (draft.groupMembers || []).map((m) => ({ ...m, signature: "" })),
    status: "draft"
  };
  printLetter(printable, { blankSignature: true });
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
  const editingReq = state.editingRequestId ? state.requests[state.editingRequestId] : null;

  if (editingReq && !canEditRequest(editingReq, user)) {
    showToast("This request was already reviewed by HR and can no longer be edited.");
    state.editingRequestId = null;
    navigateTo("my-requests");
    return;
  }
  if (editingReq && editingReq.status === "submitted" && targetStatus === "draft") {
    showToast("A request waiting for HR can't go back to draft. Save your changes, or withdraw it instead.");
    return;
  }
  if (isFormGroupMode() && draft.groupMembers.some((m) => !m.name)) {
    showToast("Enter the name of every person in the group (or remove the empty row).");
    return;
  }

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

    // Backdate check: no past dates beyond 7 days back
    const checkDate = draft.type === "multi" ? draft.startDate : draft.date;
    if (checkDate < getMinFilingDate()) {
      showToast("Date cannot be more than 7 days in the past.");
      return;
    }

    const len = draft.reasonDetails.trim().length;
    if (len < 30 || len > 400) {
      showToast("Reason details must be between 30 and 400 characters.");
      return;
    }

    if (isFormGroupMode() && draft.groupMembers.length === 0) {
      showToast("Add at least one other person to the group, or choose \"Just me\".");
      return;
    }
    if (getRequestMembers(draft).length > MAX_GROUP_SIZE) {
      showToast(`A group letter can have at most ${MAX_GROUP_SIZE} people.`);
      return;
    }

    if (draft.signatureMethod === "digital" && !draft.internSignature) {
      showToast("Your signature is required before submitting the official letter.");
      return;
    }
    if (draft.signatureMethod === "digital") {
      const unsigned = draft.groupMembers.find((m) => !m.signature);
      if (unsigned) {
        showToast(`${unsigned.name} still needs to sign on their signature pad.`);
        return;
      }
    }
    if (draft.signatureMethod === "wet-upload" && !draft.wetCopyImage) {
      showToast("Upload a photo or scan of your hand-signed letter, or choose to hand in the paper copy.");
      return;
    }

    const dup = checkDuplicateSlots(user.uid, draft, state.editingRequestId);
    if (dup.conflict) {
      const who = dup.personUid === user.uid ? "You already have" : `${dup.personName} already has`;
      showToast(`Duplicate blocked: ${who} a request on ${dup.date} (${dup.shift}).`);
      return;
    }
  }

  // Save signature to profile if checked
  const saveSigCheckbox = document.getElementById("f-save-sig");
  if (saveSigCheckbox && saveSigCheckbox.checked && draft.signatureMethod === "digital" && draft.internSignature) {
    state.users[user.uid].savedSignature = draft.internSignature;
  }

  const nowIso = new Date().toISOString();
  const reqId = state.editingRequestId || generateRequestId();
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
      ? existingReq && existingReq.status === "returned"
        ? "Revised and resubmitted letter."
        : existingReq && existingReq.status === "submitted"
        ? "Edited while waiting for HR review."
        : "Submitted official absence request."
      : "Saved as draft.",
    at: nowIso
  });

  state.requests[reqId] = {
    ...draft,
    id: reqId,
    // Everyone on the letter who has an account (lets group members see it; used by firestore.rules)
    memberUids: getRequestUids(draft),
    status: targetStatus,
    review: existingReq ? existingReq.review : null,
    // Paper copy tracking for hand-signed letters handed in to HR
    paperCopy:
      draft.signatureMethod === "wet-paper"
        ? { status: "awaiting", receivedAt: null, receivedByName: null }
        : null,
    history,
    createdAt: existingReq ? existingReq.createdAt : nowIso,
    submittedAt: targetStatus === "submitted" ? nowIso : (existingReq ? existingReq.submittedAt : null),
    updatedAt: nowIso,
    templateVersion: state.settings.letter.templateVersion
  };

  // Write absenceSlots in transaction if submitted
  if (targetStatus === "submitted") {
    getRequestUids(state.requests[reqId]).forEach((memberUid) => {
      computeSlotKeysForRequest(memberUid, draft).forEach((k) => {
        state.absenceSlots[k] = { requestId: reqId, uid: memberUid };
      });
    });
  }

  const wasPending = existingReq && existingReq.status === "submitted";
  state.editingRequestId = null;
  saveState();
  showToast(
    targetStatus === "submitted"
      ? wasPending
        ? "Changes saved. HR will see the updated letter."
        : "Request signed and submitted to HR!"
      : "Draft saved."
  );
  navigateTo("my-requests");
}

/* ==========================================
   SCREEN 4: MY REQUESTS (INTERN)
   (Withdraw while Submitted, Revise while Draft/Returned, PDF for Approved)
   ========================================== */
function renderMyRequestsScreen(user) {
  const filterStatus = window.myReqFilterStatus || "all";
  // Requests I filed, plus group requests someone else filed with me on them (view only)
  const allMyReqs = Object.values(state.requests)
    .filter((r) => requestIncludesUser(r, user.uid) && (r.uid === user.uid || r.status !== "draft"))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  const filtered = filterStatus === "all" ? allMyReqs : allMyReqs.filter((r) => r.status === filterStatus);

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">My Absence Requests</h1>
        <p class="page-subtitle">Track status, download approved A4 PDFs, edit pending or returned letters, or withdraw pending requests. Group letters others filed with you show here too.</p>
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
              <th>Status</th>
              <th>HR Remarks / Review</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              filtered.length === 0
                ? `<tr><td colspan="6" style="text-align:center; padding:28px; color:var(--text-muted);">No requests matching filter.</td></tr>`
                : filtered
                    .map(
                      (r) => `
              <tr class="${r.status === "withdrawn" ? "row-withdrawn" : ""}">
                <td>
                  <div style="font-weight:700; color:var(--apg-gold);">${escapeHtml(r.refNo || "—")}</div>
                  <div style="font-size:11.5px; color:var(--text-light);">${escapeHtml(r.id)}</div>
                  ${isGroupRequest(r) ? `<div class="group-tag" title="${escapeHtml(listRequestNames(r))}">👥 Group of ${getRequestMembers(r).length}</div>` : ""}
                  ${r.uid !== user.uid ? `<div style="font-size:11px; color:var(--text-muted);">Filed by ${escapeHtml(r.snapshot?.name || "")}</div>` : ""}
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
                <td>${renderStatusPill(r.status)}${renderPaperCopyTag(r)}</td>
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
                      canEditRequest(r, user)
                        ? `<button class="btn btn-warning btn-sm" onclick="navigateTo('new-request', { editRequestId: '${r.id}' })">${r.status === "submitted" ? "Edit" : "Edit / Revise"}</button>`
                        : ""
                    }
                    ${
                      r.status === "submitted" && r.uid === user.uid
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
  if (!req || req.status !== "submitted" || !user || req.uid !== user.uid) return;

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
// All non-draft requests (pending first) and the subset matching the HR queue filters.
// Shared by the queue screen and the CSV export so both always show the same rows.
function getHRQueueRequests() {
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

  return { allReqs, filtered, statusFilter, reasonFilter, deptFilter };
}

function renderHRQueueScreen() {
  const { allReqs, filtered, statusFilter, reasonFilter, deptFilter } = getHRQueueRequests();

  // Analytics counts
  const pendingCount = allReqs.filter((r) => r.status === "submitted").length;
  const approvedCount = allReqs.filter((r) => r.status === "approved").length;
  const returnedCount = allReqs.filter((r) => r.status === "returned").length;

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
        <div class="stat-sub">Next Ref: ${getNextRefNoPreview()}</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #ea580c;">
        <div class="stat-label">Returned for Revision</div>
        <div class="stat-value">${returnedCount}</div>
        <div class="stat-sub">Awaiting edits</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Absence Requests</div>
        <div class="stat-value">${allReqs.length}</div>
        <div class="stat-sub">Across all members</div>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="card">
      <div class="card-header" style="flex-wrap:wrap;">
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <strong style="font-size:13px; color:var(--apg-gold);">Filter Queue:</strong>
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
              <th>Member (Snapshot)</th>
              <th>Absence Type & Date(s)</th>
              <th>Reason Category</th>
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
                  <div style="font-weight:700; color:var(--apg-gold);">${escapeHtml(r.refNo || "Pending")}</div>
                  <div style="font-size:11px; color:var(--text-light);">${escapeHtml(r.id)}</div>
                </td>
                <td>
                  <div style="font-weight:700;">${escapeHtml(formatRequestNames(r))}</div>
                  ${
                    isGroupRequest(r)
                      ? `<div class="group-tag" title="${escapeHtml(listRequestNames(r))}">👥 Group of ${getRequestMembers(r).length}</div>`
                      : `<div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(r.snapshot?.position)} · <code>${escapeHtml(r.snapshot?.internId)}</code></div>`
                  }
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
                <td>${renderStatusPill(r.status)}${renderPaperCopyTag(r)}</td>
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
  const allReqs = getHRQueueRequests().filtered;
  if (allReqs.length === 0) {
    showToast("No requests match the current filters.");
    return;
  }
  const headers = ["RefNo", "RequestID", "MemberName", "MemberID", "Position", "Department", "GroupSize", "Type", "DateOrRange", "Shift", "ReasonCategory", "Status", "ReviewedBy", "ReviewRemarks"];
  const joinField = (r, field) => getRequestMembers(r).map((m) => m[field] || "").join("; ");
  const rows = allReqs.map((r) => [
    r.refNo || "",
    r.id,
    joinField(r, "name"),
    joinField(r, "internId"),
    joinField(r, "position"),
    joinField(r, "department"),
    getRequestMembers(r).length,
    r.type,
    r.type === "multi" ? `${r.startDate} to ${r.endDate}` : r.date,
    r.shift || "full",
    r.reasonCategory,
    r.status,
    r.review?.byName || "",
    r.review?.remarks || ""
  ]);

  // Quote every cell, escape quotes, and stop spreadsheet apps treating text as formulas
  const csvCell = (value) => {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csvContent =
    headers.join(",") +
    "\n" +
    rows.map((row) => row.map(csvCell).join(",")).join("\n");

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

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">HR Request Review: ${escapeHtml(formatRequestNames(req))}</h1>
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
              <div style="background:var(--apg-surface-elevated); border:1px solid var(--border); padding:10px 12px; border-radius:7px; font-size:12px; margin-bottom:14px;">
                <strong>On Approval Transaction:</strong> Assigns next reference number <code>${getNextRefNoPreview()}</code> and stamps ${escapeHtml(state.settings.letter.signatoryName)}'s official HR signature onto the letter.
              </div>
              ${
                isAwaitingPaperCopy(req)
                  ? `<div style="background:rgba(234, 88, 12, 0.15); border:1px solid rgba(251, 146, 60, 0.4); color:#fb923c; padding:8px 12px; border-radius:7px; font-size:12.5px; margin-bottom:10px;">
                      🖊️ Waiting for the hand-signed paper copy. Mark it as received in <strong>Signature Check</strong> below before approving.
                    </div>`
                  : ""
              }
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn-success" style="flex:1.2;" onclick="handleHRDecision('${req.id}', 'approved')" ${isAwaitingPaperCopy(req) ? "disabled" : ""}>
                  ✓ Approve & Sign Letter
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
                    ? `<div style="background:var(--apg-surface-elevated); padding:10px; border-radius:6px; border:1px solid var(--border);">
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

        ${renderSignatureCheckCard(req)}

        <!-- Request Details -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">📌 Request Metadata</span>
          </div>
          <div class="card-body" style="font-size:13px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
              <div><strong>Name:</strong> ${escapeHtml(req.snapshot?.name)}</div>
              <div><strong>ID Number:</strong> <code>${escapeHtml(req.snapshot?.internId)}</code></div>
              <div><strong>Member Type:</strong> <span class="user-role-tag">${escapeHtml(req.memberType || "intern")}</span></div>
              <div><strong>Position:</strong> ${escapeHtml(req.snapshot?.position)}</div>
              <div><strong>Department:</strong> ${escapeHtml(req.snapshot?.department || "—")}</div>
              <div><strong>Reason Category:</strong> ${escapeHtml(req.reasonCategory)}</div>
            </div>
            ${
              isGroupRequest(req)
                ? `<div class="group-review-list">
                     <strong>👥 Group request · ${getRequestMembers(req).length} people</strong>
                     <ul>
                       ${getRequestMembers(req)
                         .map(
                           (m) => `<li>${escapeHtml(m.name)}${m.position ? ` · ${escapeHtml(m.position)}` : ""}${m.internId ? ` · <code>${escapeHtml(m.internId)}</code>` : ""}${m.isFiler ? " <em>(filed the request)</em>" : m.uid ? "" : " <em>(no account)</em>"}</li>`
                         )
                         .join("")}
                     </ul>
                   </div>`
                : ""
            }
          </div>
        </div>

        <!-- Past Absence History -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">📂 Member's Other Absence Requests (${internHistory.length})</span>
          </div>
          <div class="card-body">
            ${
              internHistory.length === 0
                ? `<div style="color:var(--text-muted); font-size:13px;">No other requests filed by this member.</div>`
                : internHistory
                    .map(
                      (h) => `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                    <div>
                      <strong>${h.type === "multi" ? `${formatShortDate(h.startDate)} – ${formatShortDate(h.endDate)}` : formatShortDate(h.date)}</strong>
                      <span style="color:var(--text-muted);"> · ${escapeHtml(h.reasonCategory)} (${escapeHtml(h.type)})</span>
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

/* ==========================================
   HR SIGNATURE CHECK (identity verification aid)
   ========================================== */
function isAwaitingPaperCopy(req) {
  return req.signatureMethod === "wet-paper" && !(req.paperCopy && req.paperCopy.status === "received");
}

function renderSignatureCheckCard(req) {
  const method = req.signatureMethod || "digital";
  const member = state.users[req.uid] || {};
  const methodLabel = {
    digital: "✍️ Digital signature",
    "wet-upload": "🖊️ Wet signature · photo/scan uploaded",
    "wet-paper": "🖊️ Wet signature · paper copy handed in"
  }[method];

  // Earlier signatures from the same person, for side-by-side comparison
  const references = [];
  const seen = new Set();
  const addRef = (src, label) => {
    const safe = safeImageSrc(src);
    if (safe && !seen.has(safe)) {
      seen.add(safe);
      references.push({ src: safe, label });
    }
  };
  if (method === "digital") seen.add(safeImageSrc(req.internSignature));
  addRef(member.savedSignature, "Saved on profile");
  Object.values(state.requests)
    .filter((r) => r.uid === req.uid && r.id !== req.id && r.status !== "draft")
    .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))
    .forEach((r) => {
      if (references.length < 4 && (r.signatureMethod || "digital") === "digital") {
        addRef(r.internSignature, `Request ${formatShortDate(r.submittedAt || r.createdAt)}`);
      }
    });

  let mainHTML = "";
  if (method === "digital") {
    const src = safeImageSrc(req.internSignature);
    const sameAsProfile = src && src === safeImageSrc(member.savedSignature);
    mainHTML = src
      ? `<div class="sig-compare-grid"><div class="sig-compare-item is-current"><img src="${src}" alt="Signature on this request" />This request</div></div>
         ${sameAsProfile ? `<div class="form-hint" style="margin-top:6px;">Same image as the signature saved on this person's profile.</div>` : ""}`
      : `<div style="color:#f87171;">No signature on this request.</div>`;
  } else if (method === "wet-upload") {
    const src = safeImageSrc(req.wetCopyImage);
    mainHTML = src
      ? `<img src="${src}" alt="Photo of hand-signed letter" class="wet-copy-preview" style="cursor:zoom-in;" onclick="openWetCopyModal('${req.id}')" />
         <div class="form-hint">Click the photo to view it full size.</div>`
      : `<div style="color:#f87171;">No photo was uploaded.</div>`;
  } else {
    const pc = req.paperCopy || { status: "awaiting" };
    mainHTML =
      pc.status === "received"
        ? `<div style="margin-bottom:8px;"><span class="status-pill status-approved">📄 Paper copy received</span>
             <span style="font-size:12px; color:var(--text-muted);"> by ${escapeHtml(pc.receivedByName || "HR")} on ${formatShortDate(pc.receivedAt)}</span></div>
           ${
             req.status === "submitted"
               ? `<button class="btn btn-outline btn-sm" onclick="markPaperCopyReceived('${req.id}', false)">Undo</button>`
               : ""
           }`
        : `<div style="margin-bottom:8px;"><span class="status-pill status-submitted">📄 Waiting for paper copy</span></div>
           ${
             req.status === "submitted"
               ? `<button class="btn btn-success btn-sm" onclick="markPaperCopyReceived('${req.id}', true)">✓ Mark paper copy received</button>`
               : ""
           }`;
  }

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">🔏 Signature Check</span>
        <span style="font-size:11.5px; color:var(--text-muted);">${methodLabel}</span>
      </div>
      <div class="card-body" style="font-size:13px;">
        ${mainHTML}
        <div style="margin-top:14px; font-weight:700; font-size:12px; color:var(--text-muted);">
          COMPARE WITH EARLIER SIGNATURES FROM ${escapeHtml((req.snapshot?.name || "this member").toUpperCase())}
        </div>
        ${
          references.length
            ? `<div class="sig-compare-grid" style="margin-top:6px;">
                ${references
                  .map((r) => `<div class="sig-compare-item"><img src="${r.src}" alt="${escapeHtml(r.label)}" />${escapeHtml(r.label)}</div>`)
                  .join("")}
              </div>`
            : `<div class="form-hint">No earlier signatures on file yet.</div>`
        }
      </div>
    </div>
  `;
}

function markPaperCopyReceived(reqId, received) {
  const req = state.requests[reqId];
  const hrUser = getCurrentUser();
  if (!req || !hrUser || hrUser.role !== "hr") return;
  const nowIso = new Date().toISOString();
  req.paperCopy = received
    ? { status: "received", receivedAt: nowIso, receivedByName: hrUser.name }
    : { status: "awaiting", receivedAt: null, receivedByName: null };
  req.updatedAt = nowIso;
  req.history.push({
    status: req.status,
    byUid: hrUser.uid,
    byName: hrUser.name,
    remarks: received ? "Hand-signed paper copy received." : "Paper copy marked as not yet received.",
    at: nowIso
  });
  saveState();
  showToast(received ? "Paper copy marked as received. You can now approve." : "Paper copy set back to waiting.");
  renderApp();
}

function openWetCopyModal(reqId) {
  const req = state.requests[reqId];
  const modalRoot = document.getElementById("modal-root");
  const src = req && safeImageSrc(req.wetCopyImage);
  if (!src || !modalRoot) return;
  modalRoot.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) closeLetterModal()">
      <div class="modal-box">
        <div class="preview-toolbar" style="border-radius:0;">
          <span>🖊️ <strong>HAND-SIGNED LETTER</strong> · ${escapeHtml(req.snapshot?.name)}</span>
          <button class="btn btn-outline btn-sm" style="background:transparent; color:#fff; border-color:rgba(255,255,255,0.4);" onclick="closeLetterModal()">✕ Close</button>
        </div>
        <div style="padding:16px; background:#e2e8f0; text-align:center;">
          <img src="${src}" alt="Photo of hand-signed letter" style="max-width:100%; height:auto; background:#fff;" />
        </div>
      </div>
    </div>
  `;
}

function handleHRDecision(reqId, newStatus) {
  const req = state.requests[reqId];
  const hrUser = getCurrentUser();
  if (!req || !hrUser || hrUser.role !== "hr") return;

  if (newStatus === "approved" && isAwaitingPaperCopy(req)) {
    showToast("Mark the hand-signed paper copy as received before approving.");
    return;
  }

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
    const year = currentYear();
    if (!state.counters[year]) state.counters[year] = { nextRefNo: 1 };
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
  const now = new Date();
  const baseDate = new Date(now.getFullYear(), now.getMonth() + (state.calendarMonthOffset || 0), 1); // current month default
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
          <div class="cal-event ${ev.status}" onclick="navigateTo('hr-review', { reviewRequestId: '${ev.id}' })" title="Click to review ${escapeHtml(listRequestNames(ev))}">
            ${ev.type === "half" ? (ev.shift === "morning" ? "[AM]" : "[PM]") : "[FULL]"} ${escapeHtml((ev.snapshot?.name || "").split(" ")[0])}${isGroupRequest(ev) ? ` +${getRequestMembers(ev).length - 1}` : ""}
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
              <label class="form-label">Group Letter: Apology Paragraph (used when several people file one letter)</label>
              <textarea id="set-apology-group" class="form-control" rows="3" required>${escapeHtml(s.apologyParagraphGroup || DEFAULT_GROUP_APOLOGY)}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Group Letter: Thank-You Paragraph</label>
              <textarea id="set-thanks-group" class="form-control" rows="2" required>${escapeHtml(s.thankYouParagraphGroup || DEFAULT_GROUP_THANKS)}</textarea>
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

            <div class="form-group" style="background:var(--apg-surface-elevated); border:1px solid var(--border); padding:12px; border-radius:8px;">
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
            <div style="border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:12px; background:${u.status === "pending" ? "rgba(212, 163, 67, 0.12)" : "var(--apg-surface-elevated)"};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                  <strong style="font-size:14px; color:var(--apg-gold);">${escapeHtml(u.name)}</strong>
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
                  <input type="text" id="u-id-${u.uid}" class="form-control" style="padding:6px 9px; font-size:12.5px;" value="${escapeHtml(u.internId)}" placeholder="e.g. APG-INT-${currentYear()}-025 or APG-EMP-001" />
                </div>
                <div style="grid-column: span 2;">
                  <label style="font-size:11px; font-weight:700; color:var(--text-muted);">DEPARTMENT</label>
                  <input type="text" id="u-dept-${u.uid}" class="form-control" style="padding:6px 9px; font-size:12.5px;" value="${escapeHtml(u.department)}" placeholder="e.g. Marketing & HR" />
                </div>
                <div style="grid-column: span 2;">
                  <label style="font-size:11px; font-weight:700; color:var(--text-muted);">OFFICIAL POSITION TITLE (LANDS ON LETTER)</label>
                  <input type="text" id="u-pos-${u.uid}" class="form-control" style="padding:6px 9px; font-size:12.5px;" value="${escapeHtml(u.position)}" placeholder="e.g. HR/Marketing Associate or Operations Specialist" />
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
  s.apologyParagraphGroup = document.getElementById("set-apology-group").value.trim() || DEFAULT_GROUP_APOLOGY;
  s.thankYouParagraphGroup = document.getElementById("set-thanks-group").value.trim() || DEFAULT_GROUP_THANKS;
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

  if (newStatus === "active" && (!internId || !pos || !dept)) {
    showToast("Please assign an ID Number, Official Position, and Department to activate this member.");
    return;
  }

  u.role = role;
  u.memberType = role;
  u.internId = internId;
  u.department = dept;
  u.position = pos;
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
