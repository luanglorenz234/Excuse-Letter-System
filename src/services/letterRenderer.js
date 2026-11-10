/**
 * Alpha Premier — OJT Absence Request System (Production v1.0)
 * Pure Letter Renderer & Client-Side A4 PDF Export Service
 *
 * Implements Section 1 & Section 8 Step 3 of the Final Plan:
 * Pure function (request, settings) -> Locked A4 HTML over Alpha Premier letterhead.
 */

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseLocalDate(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatLongDate(ymd) {
  const dt = parseLocalDate(ymd);
  if (!dt || isNaN(dt.getTime())) return "{DATE}";
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

export function formatStandardDate(ymd) {
  const dt = parseLocalDate(ymd);
  if (!dt || isNaN(dt.getTime())) return "{DATE}";
  return dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

export function formatShortDate(isoOrYmd) {
  if (!isoOrYmd) return "—";
  const dt = isoOrYmd.length === 10 ? parseLocalDate(isoOrYmd) : new Date(isoOrYmd);
  if (!dt || isNaN(dt.getTime())) return isoOrYmd;
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function countWeekdaysBetween(startYmd, endYmd) {
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

export function getWeekdayDatesList(startYmd, endYmd) {
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
 * Opening sentence templates (Section 1 of Final Plan):
 * - Full-day:  I am writing to formally request permission to be absent from my OJT duties on {DATE}.
 * - Half-day:  I am writing to formally request permission to be absent from my OJT duties during the {SHIFT} shift ({TIME_RANGE}) of {DATE}.
 * - Multi-day: I am writing to formally request permission to be absent from my OJT duties from {START_DATE} to {END_DATE} ({N} days).
 */
export function buildOpeningSentenceHTML(req, highlightVars = true) {
  const wrap = (val) =>
    highlightVars ? `<span class="a4-var-highlight">${escapeHtml(val)}</span>` : escapeHtml(val);

  if (req.type === "half") {
    const shiftText = req.shift || "morning";
    const timeRangeText =
      req.timeRange || (shiftText === "morning" ? "8:00 AM – 12:00 PM" : "1:00 PM – 5:00 PM");
    const dateText = req.date ? formatLongDate(req.date) : "{DATE}";
    return `I respectfully request permission to be absent from my On-the-Job Training (OJT) duties during the ${wrap(
      shiftText
    )} shift (${wrap(timeRangeText)}) of ${wrap(dateText)}.`;
  }

  if (req.type === "multi") {
    const startText = req.startDate ? formatLongDate(req.startDate) : "{START_DATE}";
    const endText = req.endDate ? formatLongDate(req.endDate) : "{END_DATE}";
    const nDays =
      req.startDate && req.endDate
        ? countWeekdaysBetween(req.startDate, req.endDate)
        : req.days || "{N}";
    return `I respectfully request permission to be absent from my On-the-Job Training (OJT) duties from ${wrap(
      startText
    )} to ${wrap(endText)} (${wrap(nDays + (nDays === 1 ? " day" : " days"))}).`;
  }

  const dateText = req.date ? formatLongDate(req.date) : "{DATE}";
  return `I respectfully request permission to be absent from my On-the-Job Training (OJT) duties on ${wrap(
    dateText
  )}.`;
}

/**
 * Pure Function: Renders a request document and letter settings into an A4 HTML sheet
 * overlaying the official Alpha Premier letterhead background with exact sample letter formatting.
 */
export function renderLockedLetterHTML(req, letterSettings, options = {}) {
  const highlightVars = options.highlightVars !== false;
  const filingDateStr = formatStandardDate(
    (req.submittedAt || req.createdAt || new Date().toISOString()).slice(0, 10)
  );

  const snapshot = req.snapshot || {
    name: "Intern Name",
    internId: "APG-INT-XXXX",
    position: "Intern Position",
    department: "Department"
  };

  const openingHTML = buildOpeningSentenceHTML(req, highlightVars);
  const reasonBody = req.reasonDetails
    ? highlightVars
      ? `<span class="a4-var-highlight">${escapeHtml(req.reasonDetails)}</span>`
      : escapeHtml(req.reasonDetails)
    : `<span class="a4-var-highlight" style="color:#94a3b8;">[I need to dedicate this day to completing and finalizing our feasibility study paper, which is a major academic requirement for our course. This task requires my full attention to ensure that the paper is completed and submitted on time.]</span>`;

  const isApproved = req.status === "approved";
  const hrSigToRender =
    isApproved && req.review && req.review.hrSignature ? req.review.hrSignature : null;

  let topStampHTML = "";
  if (isApproved) {
    const approvedDate =
      req.review && req.review.at ? formatShortDate(req.review.at) : filingDateStr;
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
    <div class="a4-sheet ${options.cleanPdf ? "clean-pdf-render" : ""}" id="${
    options.elementId || "a4-letter-preview"
  }">
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
                  : `<span class="a4-sig-space-placeholder">${
                      isApproved ? "" : "[Stamped automatically upon HR Approval]"
                    }</span>`
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

/**
 * Client-side PDF Generator (html2canvas + jsPDF over A4 sheet)
 */
export async function exportLetterToPDF(req, letterSettings, onToast) {
  if (!req) return;
  if (onToast) onToast("Rendering official A4 PDF document...");

  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  holder.style.top = "0";
  holder.innerHTML = renderLockedLetterHTML(req, letterSettings, {
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
      const fileName = `${req.refNo || req.id}_${(req.snapshot?.name || "Intern").replace(
        /\s+/g,
        "_"
      )}.pdf`;
      pdf.save(fileName);
      if (onToast) onToast(`Downloaded ${fileName}`);
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
