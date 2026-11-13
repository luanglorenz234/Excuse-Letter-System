import { useMemo, useState, type FormEvent } from 'react';
import type { LetterSettingsInput } from '@/core/settings';
import { addDaysYmd, todayYmd } from '@/core/dates';
import { buildDraft, inputFrom } from '@/core/requests';
import { seedDb } from '@/core/seed';
import { LETTER_FORMAT_VERSION, type LetterSettings, type MemberType, type NotedBy } from '@/core/types';
import { Button, Card, Notice, TextInput } from '../components';
import { PageHeader } from '../App';
import { ScaledLetter } from '../letter/Letter';
import { SignaturePad } from '../SignaturePad';
import { Dialog } from '../shared';
import { useApp } from '../state/AppState';

/** The form keeps each "Noted by" list as lines of "Name | Title" while it is edited. */
type LetterForm = Omit<LetterSettingsInput, 'notedBy'> & { notedBy: Record<MemberType, string> };

const notedByText = (list: readonly NotedBy[]) => list.map((n) => (n.title ? `${n.name} | ${n.title}` : n.name)).join('\n');
const notedByList = (text: string): NotedBy[] =>
  text
    .split('\n')
    .map((line) => {
      const [name = '', ...title] = line.split('|');
      return { name: name.trim(), title: title.join('|').trim() };
    })
    .filter((n) => n.name);

function formFrom(s: LetterSettings): LetterForm {
  return {
    hrOfficerEmail: s.hrOfficerEmail,
    signatoryName: s.signatoryName,
    signatoryTitle: s.signatoryTitle,
    companyName: s.companyName,
    subject: s.subject,
    hrSignature: s.hrSignature,
    attachmentsEnabled: s.attachmentsEnabled,
    notedBy: { intern: notedByText(s.notedBy.intern), employee: notedByText(s.notedBy.employee) },
  };
}

function inputFromForm(form: LetterForm): LetterSettingsInput {
  return { ...form, notedBy: { intern: notedByList(form.notedBy.intern), employee: notedByList(form.notedBy.employee) } };
}

const SAMPLE_REASON = 'I have a meeting with our department chairperson for our capstone project on the said date.';

/** A made-up request in one format, to preview the letter before saving. */
function sampleLetter(format: MemberType, settings: LetterSettings) {
  const now = new Date();
  // The next weekday, so the sample reads like a real request.
  let day = addDaysYmd(todayYmd(now), 1);
  while ([0, 6].includes(new Date(`${day}T12:00:00`).getDay())) day = addDaysYmd(day, 1);
  const input = {
    ...inputFrom(null, day, addDaysYmd(day, 1), format),
    name: 'Juan Dela Cruz',
    position: format === 'employee' ? 'IT Administrator' : '',
    department: 'IT',
    reasonDetails: SAMPLE_REASON,
  };
  return { request: { ...buildDraft(input, null, now), submittedAt: now.toISOString() }, settings };
}

/**
 * HR's settings: who the letter is addressed to, who notes each format, and
 * the approval signature. The wording of the letters is fixed.
 */
export function SettingsScreen() {
  const app = useApp();
  const current = app.db.settings.letter;
  const locked = !app.mayEditSettings;
  const [form, setForm] = useState<LetterForm>(() => formFrom(current));
  const [preview, setPreview] = useState<MemberType | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof LetterForm>(key: K, value: LetterForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setNotedBy = (format: MemberType, value: string) => setForm((f) => ({ ...f, notedBy: { ...f.notedBy, [format]: value } }));

  const previewLetter = useMemo(
    () => (preview ? sampleLetter(preview, { ...current, ...inputFromForm(form), formatVersion: LETTER_FORMAT_VERSION }) : null),
    [preview, current, form],
  );

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await app.act({ action: 'saveSettings', settings: inputFromForm(form) });
    setBusy(false);
  };

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Who the letters are addressed to, who notes them, and your approval signature." />
      <Card
        title="Letter"
        description={`Template v${current.templateVersion}. The wording of the intern and employee letters is fixed; interns get the intern letter, employees the employee letter.`}
      >
        <form className="stack" onSubmit={(e) => void save(e)}>
          {locked ? (
            <Notice tone="info">Only the HR officer ({current.hrOfficerEmail}) can change these settings. You can see them here.</Notice>
          ) : current.hrOfficerEmail ? null : (
            <Notice tone="warn" title="Name the HR officer">
              No HR officer is named yet, so nobody can approve letters. Enter the sign-in email of the HR account that approves and signs them. After that, only that
              account can change these settings.
            </Notice>
          )}
          <fieldset className="stack" disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <TextInput
            label="HR officer's sign-in email (approves and signs letters, and changes these settings)"
            type="email"
            value={form.hrOfficerEmail}
            onChange={(e) => set('hrOfficerEmail', e.target.value)}
            hint="Must match the HR account in Firebase. Changing it hands approving over to that account."
            required
          />
          <div className="grid-2">
            <TextInput label="HR officer (addressed to, signs on approval)" value={form.signatoryName} onChange={(e) => set('signatoryName', e.target.value)} required />
            <TextInput label="HR officer's title" value={form.signatoryTitle} onChange={(e) => set('signatoryTitle', e.target.value)} required />
            <TextInput label="Company" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} required />
            <TextInput label="Subject" value={form.subject} onChange={(e) => set('subject', e.target.value)} required />
          </div>

          <div className="grid-2">
            {(['intern', 'employee'] as const).map((f) => (
              <div key={f} className="field">
                <div className="field__label-row">
                  <label className="field__label" htmlFor={`set-${f}-noted`}>
                    Noted by · {f} letter <span className="muted small">(one per line: Name | Title)</span>
                  </label>
                  <Button size="small" variant="link" type="button" onClick={() => setPreview(f)}>
                    Preview
                  </Button>
                </div>
                <textarea id={`set-${f}-noted`} className="field__textarea" rows={4} value={form.notedBy[f]} onChange={(e) => setNotedBy(f, e.target.value)} />
              </div>
            ))}
          </div>
          <p className="field__hint">
            Your signature goes above the line whose name matches the HR officer above when you approve a letter. Everyone else listed signs the
            printed copy by hand.
          </p>

          <SignaturePad
            label="Approval signature (added to a letter when you approve it)"
            value={form.hrSignature}
            onChange={(v) => set('hrSignature', v)}
            allowUpload
            extra={
              <Button size="small" variant="ghost" type="button" onClick={() => set('hrSignature', seedDb().settings.letter.hrSignature)}>
                Reset to default
              </Button>
            }
          />
          <label className="check">
            <input type="checkbox" checked={form.attachmentsEnabled} onChange={(e) => set('attachmentsEnabled', e.target.checked)} />
            <span>Allow attachments on requests</span>
          </label>
          {locked ? null : (
            <div className="row">
              <Button variant="primary" type="submit" busy={busy}>
                Save letter settings
              </Button>
              <Button variant="ghost" type="button" onClick={() => setForm(formFrom(current))}>
                Discard changes
              </Button>
            </div>
          )}
          </fieldset>
        </form>
      </Card>
      {previewLetter && preview ? (
        <Dialog title={`Preview · ${preview} letter (not saved yet)`} onClose={() => setPreview(null)}>
          <div className="preview__stage">
            <ScaledLetter request={previewLetter.request} settings={previewLetter.settings} highlight={false} maxWidth={800} />
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
