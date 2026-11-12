import { useState, type FormEvent } from 'react';
import { saveLetterSettings, updateMember, type MemberEdit } from '@/core/accounts';
import { seedDb } from '@/core/seed';
import type { LetterSettings, User, UserStatus } from '@/core/types';
import { Button, Card, EmptyState, Pill, TextInput, type Tone } from '../components';
import { PageHeader } from '../App';
import { SignaturePad } from '../SignaturePad';
import { useApp, useUser } from '../state/AppState';

type LetterForm = Omit<LetterSettings, 'templateVersion' | 'companyName'>;

function formFrom(s: LetterSettings): LetterForm {
  const { templateVersion: _v, companyName: _c, ...rest } = s;
  return rest;
}

const TEXT_FIELDS: readonly { key: keyof LetterForm; label: string; rows?: number }[] = [
  { key: 'subject', label: 'Subject line' },
  { key: 'salutation', label: 'Salutation' },
  { key: 'addressBlock', label: 'Address block', rows: 3 },
  { key: 'apologyParagraph', label: 'Apology paragraph (one person)', rows: 3 },
  { key: 'thankYouParagraph', label: 'Thank-you paragraph (one person)', rows: 2 },
  { key: 'apologyParagraphGroup', label: 'Apology paragraph (group letter)', rows: 3 },
  { key: 'thankYouParagraphGroup', label: 'Thank-you paragraph (group letter)', rows: 2 },
];

export function SettingsScreen() {
  const app = useApp();
  const hr = useUser();
  const current = app.db.settings.letter;
  const [form, setForm] = useState<LetterForm>(() => formFrom(current));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof LetterForm>(key: K, value: LetterForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await app.run(saveLetterSettings(app.db, hr, form));
    setBusy(false);
  };

  const members = Object.values(app.db.users)
    .filter((u) => u.role !== 'hr')
    .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || a.name.localeCompare(b.name));

  return (
    <div className="page page--wide">
      <PageHeader title="Settings" subtitle="The wording every letter uses, the approval signature, and member profiles." />
      <div className="grid-2">
        <Card title="Letter" description={`Template v${current.templateVersion}. Each save makes a new version; letters keep the version they were filed with.`}>
          <form className="stack" onSubmit={(e) => void save(e)}>
            <div className="grid-2">
              <TextInput label="Signatory name" value={form.signatoryName} onChange={(e) => set('signatoryName', e.target.value)} required />
              <TextInput label="Signatory title" value={form.signatoryTitle} onChange={(e) => set('signatoryTitle', e.target.value)} required />
            </div>
            {TEXT_FIELDS.map(({ key, label, rows }) =>
              rows ? (
                <div key={key} className="field">
                  <label className="field__label" htmlFor={`set-${key}`}>
                    {label}
                  </label>
                  <textarea id={`set-${key}`} className="field__textarea" rows={rows} value={String(form[key])} onChange={(e) => set(key, e.target.value)} />
                </div>
              ) : (
                <TextInput key={key} label={label} value={String(form[key])} onChange={(e) => set(key, e.target.value)} required />
              ),
            )}
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
