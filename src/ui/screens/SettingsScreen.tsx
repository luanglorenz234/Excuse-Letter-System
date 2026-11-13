import { useMemo, useState, type FormEvent } from 'react';
import { saveLetterSettings, type LetterSettingsInput } from '@/core/accounts';
import { addDaysYmd, todayYmd } from '@/core/dates';
import { buildDraft, inputFrom } from '@/core/requests';
import { seedDb } from '@/core/seed';
import { LETTER_FORMAT_VERSION, type LetterSettings, type MemberType, type NotedBy, type User } from '@/core/types';
import { Button, Card, TextInput } from '../components';
import { PageHeader } from '../App';
import { ScaledLetter } from '../letter/Letter';
import { SignaturePad } from '../SignaturePad';
import { Dialog } from '../shared';
import { useApp, useUser } from '../state/AppState';

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
  const employee: User = {
    uid: 'sample',
    name: 'Juan Dela Cruz',
    email: '',
    internId: '',
    position: 'IT Administrator',
    department: 'IT',
    role: 'employee',
    memberType: 'employee',
    status: 'active',
    createdAt: now.toISOString(),
  };
  const filer = format === 'employee' ? employee : null;
  // The next weekday, so the sample reads like a real request.
  let day = addDaysYmd(todayYmd(now), 1);
  while ([0, 6].includes(new Date(`${day}T12:00:00`).getDay())) day = addDaysYmd(day, 1);
  const input = { ...inputFrom(null, filer, day, addDaysYmd(day, 1)), name: 'Juan Dela Cruz', department: 'IT', reasonDetails: SAMPLE_REASON };
  return { request: { ...buildDraft(input, filer, null, now), submittedAt: now.toISOString() }, settings };
}

/**
 * HR's settings: who the letter is addressed to, who notes each format, and
 * the approval signature. The wording of the letters is fixed.
 */
export function SettingsScreen() {
  const app = useApp();
  const hr = useUser();
  const current = app.db.settings.letter;
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
    await app.run(saveLetterSettings(app.db, hr, inputFromForm(form)));
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
          <div className="row">
            <Button variant="primary" type="submit" busy={busy}>
              Save letter settings
            </Button>
            <Button variant="ghost" type="button" onClick={() => setForm(formFrom(current))}>
              Discard changes
            </Button>
          </div>
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
