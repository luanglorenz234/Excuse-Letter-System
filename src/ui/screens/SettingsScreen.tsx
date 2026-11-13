import { useMemo, useState, type FormEvent } from 'react';
import { saveLetterSettings, updateMember, type LetterSettingsInput, type MemberEdit } from '@/core/accounts';
import { addDaysYmd, todayYmd } from '@/core/dates';
import { buildDraft, inputFrom } from '@/core/requests';
import { seedDb } from '@/core/seed';
import { LETTER_FORMAT_VERSION, type FormatWording, type LetterSettings, type MemberType, type NotedBy, type User, type UserStatus } from '@/core/types';
import { Button, Card, EmptyState, Pill, TextInput, type Tone } from '../components';
import { PageHeader } from '../App';
import { ScaledLetter } from '../letter/Letter';
import { SignaturePad } from '../SignaturePad';
import { Dialog } from '../shared';
import { useApp, useUser } from '../state/AppState';

/** The form keeps each "Noted by" list as lines of "Name | Title" while it is edited. */
type FormatForm = Omit<FormatWording, 'notedBy'> & { notedBy: string };
type LetterForm = Omit<LetterSettingsInput, 'formats'> & { formats: Record<MemberType, FormatForm> };

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
  const f = (w: FormatWording): FormatForm => ({ ...w, notedBy: notedByText(w.notedBy) });
  return {
    signatoryName: s.signatoryName,
    signatoryTitle: s.signatoryTitle,
    companyName: s.companyName,
    subject: s.subject,
    hrSignature: s.hrSignature,
    attachmentsEnabled: s.attachmentsEnabled,
    formats: { intern: f(s.formats.intern), employee: f(s.formats.employee) },
  };
}

function inputFromForm(form: LetterForm): LetterSettingsInput {
  const f = (w: FormatForm): FormatWording => ({ ...w, notedBy: notedByList(w.notedBy) });
  return { ...form, formats: { intern: f(form.formats.intern), employee: f(form.formats.employee) } };
}

const FORMAT_FIELDS: readonly { key: Exclude<keyof FormatForm, 'notedBy'>; label: string; rows?: number }[] = [
  { key: 'salutation', label: 'Greeting' },
  { key: 'apologyParagraph', label: 'Second paragraph (one person)', rows: 3 },
  { key: 'apologyParagraphGroup', label: 'Second paragraph (group letter)', rows: 3 },
  { key: 'thankYouParagraph', label: 'Thank-you line (one person)', rows: 2 },
  { key: 'thankYouParagraphGroup', label: 'Thank-you line (group letter)', rows: 2 },
  { key: 'closing', label: 'Closing' },
];

const SAMPLE_REASON = 'I have a meeting with our department chairperson for our capstone project on the said date.';

/** A made-up request in one format, to preview the wording before saving. */
function sampleLetter(format: MemberType, settings: LetterSettings) {
  const now = new Date();
  const user: User = {
    uid: 'sample',
    name: 'Juan Dela Cruz',
    email: '',
    internId: 'APG-SAMPLE',
    position: format === 'employee' ? 'IT Administrator' : 'IT Associate Intern',
    department: 'IT',
    role: format,
    memberType: format,
    status: 'active',
    createdAt: now.toISOString(),
  };
  // The next weekday, so the sample reads like a real request.
  let day = addDaysYmd(todayYmd(now), 1);
  while ([0, 6].includes(new Date(`${day}T12:00:00`).getDay())) day = addDaysYmd(day, 1);
  const input = { ...inputFrom(null, user, day, addDaysYmd(day, 1)), memberType: format, reasonDetails: SAMPLE_REASON };
  return { request: { ...buildDraft(input, user, null, now), submittedAt: now.toISOString() }, settings };
}

export function SettingsScreen() {
  const app = useApp();
  const hr = useUser();
  const current = app.db.settings.letter;
  const [form, setForm] = useState<LetterForm>(() => formFrom(current));
  const [format, setFormat] = useState<MemberType>('intern');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof LetterForm>(key: K, value: LetterForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setWording = (key: keyof FormatForm, value: string) =>
    setForm((f) => ({ ...f, formats: { ...f.formats, [format]: { ...f.formats[format], [key]: value } } }));
  const wording = form.formats[format];

  const previewLetter = useMemo(
    () => (preview ? sampleLetter(format, { ...current, ...inputFromForm(form), formatVersion: LETTER_FORMAT_VERSION }) : null),
    [preview, format, current, form],
  );

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await app.run(saveLetterSettings(app.db, hr, inputFromForm(form)));
    setBusy(false);
  };

  const members = Object.values(app.db.users)
    .filter((u) => u.role !== 'hr')
    .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || a.name.localeCompare(b.name));

  return (
    <div className="page page--wide">
      <PageHeader title="Settings" subtitle="The wording of the intern and employee letters, the approval signature, and member profiles." />
      <div className="grid-2">
        <Card title="Letter" description={`Template v${current.templateVersion}. Interns and employees each get their own format; "Filing as" on a request picks it.`}>
          <form className="stack" onSubmit={(e) => void save(e)}>
            <div className="grid-2">
              <TextInput label="HR officer (addressed to, signs on approval)" value={form.signatoryName} onChange={(e) => set('signatoryName', e.target.value)} required />
              <TextInput label="HR officer's title" value={form.signatoryTitle} onChange={(e) => set('signatoryTitle', e.target.value)} required />
              <TextInput label="Company" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} required />
              <TextInput label="Subject" value={form.subject} onChange={(e) => set('subject', e.target.value)} required />
            </div>

            <div className="row row--between">
              <div className="segmented" role="radiogroup" aria-label="Letter format">
                {(['intern', 'employee'] as const).map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={format === f} className="segmented__option" onClick={() => setFormat(f)}>
                    {f === 'intern' ? 'Intern letter' : 'Employee letter'}
                  </button>
                ))}
              </div>
              <Button size="small" variant="ghost" type="button" onClick={() => setPreview(true)}>
                Preview {format} letter
              </Button>
            </div>

            {FORMAT_FIELDS.map(({ key, label, rows }) =>
              rows ? (
                <div key={`${format}-${key}`} className="field">
                  <label className="field__label" htmlFor={`set-${format}-${key}`}>
                    {label}
                  </label>
                  <textarea id={`set-${format}-${key}`} className="field__textarea" rows={rows} value={wording[key]} onChange={(e) => setWording(key, e.target.value)} />
                </div>
              ) : (
                <TextInput key={`${format}-${key}`} label={label} value={wording[key]} onChange={(e) => setWording(key, e.target.value)} required />
              ),
            )}
            <div className="field">
              <label className="field__label" htmlFor={`set-${format}-noted`}>
                Noted by <span className="muted small">(one per line: Name | Title)</span>
              </label>
              <textarea id={`set-${format}-noted`} className="field__textarea" rows={3} value={wording.notedBy} onChange={(e) => setWording('notedBy', e.target.value)} />
              <span className="field__hint">The approval signature goes above the line whose name matches the HR officer above.</span>
            </div>

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

        <Card title="Members" description="Members can't change their own ID number, position or department: those print on official letters exactly as set here.">
          {members.length === 0 ? (
            <EmptyState title="No members yet" headingLevel={3}>
              People who register show up here.
            </EmptyState>
          ) : (
            <div className="stack">
              {members.map((u) => (
                <MemberRow key={u.uid} member={u} />
              ))}
            </div>
          )}
        </Card>
      </div>
      {previewLetter ? (
        <Dialog title={`Preview · ${format} letter (not saved yet)`} onClose={() => setPreview(false)}>
          <div className="preview__stage">
            <ScaledLetter request={previewLetter.request} settings={previewLetter.settings} highlight={false} maxWidth={800} />
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

const STATUS_TONE: Record<UserStatus, Tone> = { active: 'ok', pending: 'warn', disabled: 'danger' };

function MemberRow({ member: u }: { member: User }) {
  const app = useApp();
  const hr = useUser();
  const [edit, setEdit] = useState<Omit<MemberEdit, 'status'>>({
    role: u.role === 'employee' ? 'employee' : 'intern',
    internId: u.internId,
    position: u.position,
    department: u.department,
  });
  const [busy, setBusy] = useState(false);
  const save = async (status: UserStatus) => {
    setBusy(true);
    await app.run(updateMember(app.db, hr, u.uid, { ...edit, status }));
    setBusy(false);
  };
  const id = (f: string) => `m-${u.uid}-${f}`;

  return (
    <div className={`member${u.status === 'pending' ? ' member--pending' : ''}`}>
      <div className="row row--between">
        <div>
          <div className="cell-main">{u.name}</div>
          <div className="cell-sub">{u.email}</div>
        </div>
        <Pill tone={STATUS_TONE[u.status]} dot>
          {u.status}
        </Pill>
      </div>
      <div className="grid-2">
        <div className="field">
          <label className="field__label" htmlFor={id('role')}>
            Member type
          </label>
          <select id={id('role')} className="field__select" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value === 'employee' ? 'employee' : 'intern' })}>
            <option value="intern">Intern</option>
            <option value="employee">Employee</option>
          </select>
        </div>
        <TextInput label="ID number" value={edit.internId} onChange={(e) => setEdit({ ...edit, internId: e.target.value })} />
      </div>
      <TextInput label="Department" value={edit.department} onChange={(e) => setEdit({ ...edit, department: e.target.value })} />
      <TextInput label="Official position (prints on the letter)" value={edit.position} onChange={(e) => setEdit({ ...edit, position: e.target.value })} />
      <div className="row row--end">
        <Button size="small" variant="primary" busy={busy} onClick={() => void save('active')}>
          {u.status === 'pending' ? 'Activate' : u.status === 'disabled' ? 'Re-enable' : 'Save'}
        </Button>
        {u.status !== 'disabled' ? (
          <Button size="small" variant="ghost" disabled={busy} onClick={() => void save('disabled')}>
            Disable
          </Button>
        ) : null}
      </div>
    </div>
  );
}
