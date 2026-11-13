import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { addDaysYmd, minFilingDate, todayYmd } from '@/core/dates';
import {
  DEFAULT_TIME_RANGE,
  buildDraft,
  canEdit,
  conflictMessage,
  findConflict,
  inputFrom,
  newRequestId,
  saveRequest,
  type DraftInput,
} from '@/core/requests';
import { MAX_GROUP_SIZE, REASON_CATEGORIES, REASON_MAX, REASON_MIN, type AbsenceType, type GroupMember, type SignatureMethod, type User } from '@/core/types';
import { Button, Card, Notice } from '../components';
import { ScaledLetter, safeImageSrc } from '../letter/Letter';
import { printLetter } from '../letter/print';
import { PageHeader } from '../App';
import { SignaturePad, compressImageFile } from '../SignaturePad';
import { useApp, useUser } from '../state/AppState';
import { paths } from '../state/paths';

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className="segmented__option" onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** New request, or editing one: the form on the left, the live letter on the right. */
export function RequestFormScreen() {
  const { id } = useParams();
  const app = useApp();
  const user = useUser();
  const existing = id ? app.db.requests[id] ?? null : null;
  if (id && !canEdit(existing, user)) return <Navigate to={paths.myRequests} replace />;
  return <RequestForm key={id ?? 'new'} user={user} editingId={existing ? existing.id : null} />;
}

function RequestForm({ user, editingId }: { user: User; editingId: string | null }) {
  const app = useApp();
  const navigate = useNavigate();
  const existing = editingId ? app.db.requests[editingId] ?? null : null;
  const tomorrow = addDaysYmd(todayYmd(), 1);
  const [input, setInput] = useState<DraftInput>(() => inputFrom(existing, user, tomorrow, addDaysYmd(tomorrow, 1)));
  const [saveSig, setSaveSig] = useState(true);
  const [busy, setBusy] = useState<null | 'draft' | 'submitted'>(null);
  const [addPick, setAddPick] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const set = <K extends keyof DraftInput>(key: K, value: DraftInput[K]) => setInput((cur) => ({ ...cur, [key]: value }));
  const setMember = (i: number, patch: Partial<GroupMember>) =>
    setInput((cur) => ({ ...cur, groupMembers: cur.groupMembers.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));

  const draft = useMemo(() => buildDraft(input, user, existing, new Date()), [input, user, existing]);
  const conflict = useMemo(() => findConflict(app.db, draft, editingId), [app.db, draft, editingId]);
  const isPending = existing?.status === 'submitted';
  const reasonLen = input.reasonDetails.trim().length;
  const minDate = minFilingDate();
  const digital = input.signatureMethod === 'digital';
  const full = input.groupMembers.length + 1 >= MAX_GROUP_SIZE;

  const addable = useMemo(() => {
    const taken = new Set(input.groupMembers.map((m) => m.uid).filter(Boolean));
    return Object.values(app.db.users)
      .filter((u) => (u.role === 'intern' || u.role === 'employee') && u.status === 'active' && u.uid !== user.uid && !taken.has(u.uid))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [app.db.users, input.groupMembers, user.uid]);

  const addFromList = () => {
    const u = app.db.users[addPick];
    if (!u) {
      app.notify('Choose a person from the list first.', 'warn');
      return;
    }
    if (full) {
      app.notify(`A group letter can have at most ${MAX_GROUP_SIZE} people.`, 'warn');
      return;
    }
    set('groupMembers', [
      ...input.groupMembers,
      { uid: u.uid, name: u.name, internId: u.internId, position: u.position, department: u.department, memberType: u.memberType ?? (u.role === 'employee' ? 'employee' : 'intern'), signature: '' },
    ]);
    setAddPick('');
  };
  const addManual = () => {
    if (full) {
      app.notify(`A group letter can have at most ${MAX_GROUP_SIZE} people.`, 'warn');
      return;
    }
    set('groupMembers', [...input.groupMembers, { uid: null, name: '', internId: '', position: '', department: '', memberType: input.memberType, signature: '' }]);
  };

  const setMethod = (method: SignatureMethod) => set('signatureMethod', method);
  const wetDelivery: SignatureMethod = input.signatureMethod === 'wet-paper' ? 'wet-paper' : 'wet-upload';

  const printToSign = () => {
    const hasDate = input.type === 'multi' ? input.startDate && input.endDate : input.date;
    if (!hasDate || reasonLen < REASON_MIN) {
      app.notify(`Fill in the date(s) and a reason of at least ${REASON_MIN} characters before printing.`, 'warn');
      return;
    }
    void printLetter({ ...draft, internSignature: '', groupMembers: draft.groupMembers.map((m) => ({ ...m, signature: '' })), status: 'draft' }, app.db.settings.letter, { blankSignature: true });
  };

  const save = async (target: 'draft' | 'submitted') => {
    setBusy(target);
    const now = new Date();
    const outcome = saveRequest(app.db, user, input, target, editingId, { now, newId: newRequestId(now), saveSignatureToProfile: saveSig });
    setProblem(outcome.ok ? null : outcome.error);
    const saved = await app.run(outcome);
    setBusy(null);
    if (saved) navigate(paths.myRequests);
  };

  return (
    <div className="page page--wide">
      <PageHeader
        title={isPending ? 'Edit pending request' : existing ? 'Revise request' : 'New absence request'}
        subtitle="Fill in the details. The official letter on the right updates as you type; its wording is set by HR."
        actions={
          <Button variant="ghost" onClick={() => navigate(paths.myRequests)}>
            Back to my requests
          </Button>
        }
      />

      {existing?.status === 'returned' && existing.review ? (
        <Notice tone="warn" title={`Returned for revision by ${existing.review.byName}`}>
          HR remarks: "{existing.review.remarks}"
        </Notice>
      ) : null}
      {isPending ? (
        <Notice tone="info">This request is still waiting for HR. Your changes replace the version HR sees. Once HR decides on it, it can no longer be edited.</Notice>
      ) : null}

      <div className="workspace">
        <div className="stack">
          <Card title="1. Absence details" description={`On the letter: ${user.name} · ${user.position || 'no position yet'} · ${user.internId || 'no ID yet'}`}>
            <div className="stack">
              <div className="field">
                <label className="field__label" htmlFor="f-member-type">
                  Filing as
                </label>
                <select id="f-member-type" className="field__select" value={input.memberType} onChange={(e) => set('memberType', e.target.value === 'employee' ? 'employee' : 'intern')}>
                  <option value="intern">Intern</option>
                  <option value="employee">Employee</option>
                </select>
              </div>

              <div className="field">
                <span className="field__label">Who is absent?</span>
                <Segmented
                  label="Who is absent?"
                  value={input.groupMode ? 'group' : 'solo'}
                  options={[
                    ['solo', 'Just me'],
                    ['group', 'Group (same reason)'],
                  ]}
                  onChange={(v) => set('groupMode', v === 'group')}
                />
              </div>

              {input.groupMode ? (
                <div className="stack stack--tight" aria-label="Group members">
                  <p className="small muted">
                    You are listed first. Add everyone else absent with you for the same reason, up to {MAX_GROUP_SIZE} people in total.
                    {digital ? ' Each person signs on their own pad.' : ' Everyone signs the printed letter.'}
                  </p>
                  {input.groupMembers.length === 0 ? <p className="small muted">No one added yet.</p> : null}
                  {input.groupMembers.map((m, i) => (
                    <div key={i} className="group-member">
                      <div className="group-member__head">
                        {m.uid ? (
                          <div>
                            <div className="cell-main">{m.name}</div>
                            <div className="cell-sub">
                              {m.position || '—'}
                              {m.internId ? ` · ${m.internId}` : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="stack stack--tight" style={{ flex: 1 }}>
                            <input className="field__input" placeholder="Full name *" aria-label="Full name" value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} />
                            <input className="field__input" placeholder="ID number (optional)" aria-label="ID number" value={m.internId} onChange={(e) => setMember(i, { internId: e.target.value })} />
                            <input className="field__input" placeholder="Position" aria-label="Position" value={m.position} onChange={(e) => setMember(i, { position: e.target.value })} />
                          </div>
                        )}
                        <Button size="small" variant="ghost" onClick={() => set('groupMembers', input.groupMembers.filter((_, j) => j !== i))}>
                          Remove
                        </Button>
                      </div>
                      {digital ? <SignaturePad small label={m.name || 'This person'} value={m.signature} onChange={(sig) => setMember(i, { signature: sig })} /> : null}
                    </div>
                  ))}
                  <div className="row">
                    <select className="field__select" style={{ flex: 1, minWidth: 200 }} aria-label="Choose a person to add" value={addPick} onChange={(e) => setAddPick(e.target.value)}>
                      <option value="">{addable.length ? 'Choose an intern or employee…' : 'Everyone in the list is already added'}</option>
                      {addable.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.name} — {u.position || u.role}
                        </option>
                      ))}
                    </select>
                    <Button size="small" variant="ghost" onClick={addFromList}>
                      Add
                    </Button>
                  </div>
                  <div>
                    <Button size="small" variant="link" onClick={addManual}>
                      Add someone not in the list
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="field">
                <span className="field__label">Absence type</span>
                <Segmented<AbsenceType>
                  label="Absence type"
                  value={input.type}
                  options={[
                    ['full', 'Full day'],
                    ['half', 'Half day'],
                    ['multi', 'Several days'],
                  ]}
                  onChange={(v) => set('type', v)}
                />
              </div>

              {input.type === 'multi' ? (
                <div className="grid-2">
                  <div className="field">
                    <label className="field__label" htmlFor="f-start">
                      Start date
                    </label>
                    <input id="f-start" type="date" className="field__input" min={minDate} value={input.startDate} onChange={(e) => set('startDate', e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="f-end">
                      End date
                    </label>
                    <input id="f-end" type="date" className="field__input" min={minDate} value={input.endDate} onChange={(e) => set('endDate', e.target.value)} />
                  </div>
                  <p className="small muted">Weekdays counted (Mon–Fri): {draft.days}</p>
                </div>
              ) : (
                <div className="field">
                  <label className="field__label" htmlFor="f-date">
                    Date of absence
                  </label>
                  <input id="f-date" type="date" className="field__input" min={minDate} value={input.date} onChange={(e) => set('date', e.target.value)} />
                  <p className="field__hint">Up to 7 days back.</p>
                </div>
              )}

              {input.type === 'half' ? (
                <div className="grid-2">
                  <div className="field">
                    <label className="field__label" htmlFor="f-shift">
                      Shift
                    </label>
                    <select
                      id="f-shift"
                      className="field__select"
                      value={input.shift}
                      onChange={(e) => {
                        const shift = e.target.value === 'afternoon' ? 'afternoon' : 'morning';
                        setInput((cur) => ({ ...cur, shift, timeRange: DEFAULT_TIME_RANGE[shift] }));
                      }}
                    >
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="f-time">
                      Time range
                    </label>
                    <input id="f-time" className="field__input" value={input.timeRange} onChange={(e) => set('timeRange', e.target.value)} />
                  </div>
                </div>
              ) : null}

              {conflict ? (
                <Notice tone="danger" live>
                  {conflictMessage(conflict, user.uid)}
                </Notice>
              ) : null}

              <div className="field">
                <label className="field__label" htmlFor="f-category">
                  Reason category <span className="muted small">(for HR, not printed)</span>
                </label>
                <select id="f-category" className="field__select" value={input.reasonCategory} onChange={(e) => set('reasonCategory', e.target.value)}>
                  {REASON_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <div className="field__label-row">
                  <label className="field__label" htmlFor="f-details">
                    Reason
                  </label>
                  <span className={`field__count ${reasonLen < REASON_MIN ? 'field__count--bad' : 'field__count--good'}`}>
                    {reasonLen} / {REASON_MAX} (min {REASON_MIN})
                  </span>
                </div>
                <textarea
                  id="f-details"
                  className="field__textarea"
                  rows={4}
                  maxLength={REASON_MAX}
                  value={input.reasonDetails}
                  onChange={(e) => set('reasonDetails', e.target.value)}
                  placeholder={input.groupMode ? 'e.g. We have a meeting with our department chairperson for our capstone project on the said date.' : 'e.g. I have a meeting with our department chairperson for our capstone project on the said date.'}
                />
                <span className="field__hint">It finishes the first sentence: "…permission to be absent on [date] as …". Check how it reads in the preview.</span>
              </div>
            </div>
          </Card>

          <Card title="2. Signature" description="Choose how you will sign.">
            <div className="stack">
              <Segmented
                label="Signature"
                value={digital ? 'digital' : 'wet'}
                options={[
                  ['digital', 'Digital signature'],
                  ['wet', 'Wet signature (by hand)'],
                ]}
                onChange={(v) => setMethod(v === 'digital' ? 'digital' : wetDelivery)}
              />
              {digital ? (
                <>
                  <SignaturePad
                    label="Your signature"
                    value={input.internSignature}
                    onChange={(sig) => set('internSignature', sig)}
                    allowUpload
                    extra={
                      user.savedSignature ? (
                        <Button size="small" variant="ghost" onClick={() => set('internSignature', user.savedSignature ?? '')}>
                          Use saved signature
                        </Button>
                      ) : null
                    }
                  />
                  <label className="check">
                    <input type="checkbox" checked={saveSig} onChange={(e) => setSaveSig(e.target.checked)} />
                    Save this signature to my profile for next time
                  </label>
                </>
              ) : (
                <div className="stack">
                  <ol className="stack stack--tight" style={{ paddingLeft: 20 }}>
                    <li>Fill in the form above.</li>
                    <li>
                      <Button size="small" variant="ghost" onClick={printToSign}>
                        Print the letter to sign
                      </Button>
                    </li>
                    <li>Sign above your name with a pen{input.groupMode ? ' (everyone in the group signs)' : ''}.</li>
                    <li>Choose how HR gets the signed letter:</li>
                  </ol>
                  <Segmented<SignatureMethod>
                    label="How HR gets the signed letter"
                    value={wetDelivery}
                    options={[
                      ['wet-upload', 'Upload a photo or scan'],
                      ['wet-paper', 'Hand in the paper copy'],
                    ]}
                    onChange={setMethod}
                  />
                  {input.signatureMethod === 'wet-upload' ? (
                    <div className="stack stack--tight">
                      <input
                        type="file"
                        accept="image/*"
                        aria-label="Photo of the signed letter"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            set('wetCopyImage', await compressImageFile(file));
                            app.notify('Signed letter photo attached.');
                          } catch (err) {
                            e.target.value = '';
                            app.notify(err instanceof Error ? err.message : String(err), 'warn');
                          }
                        }}
                      />
                      <p className="small muted">Take a clear photo of the whole page. Large photos are shrunk automatically.</p>
                      {safeImageSrc(input.wetCopyImage) ? <img className="wet-photo" src={safeImageSrc(input.wetCopyImage)} alt="Signed letter" /> : null}
                    </div>
                  ) : (
                    <p className="small muted">Submit this form now, then give the signed paper to HR. HR can approve once they receive it.</p>
                  )}
                </div>
              )}
            </div>
          </Card>

          {!app.db.settings.letter.attachmentsEnabled ? null : <Notice tone="info">Attachments are turned on in HR settings but are not supported in this version yet.</Notice>}

          {problem ? (
            <Notice tone="danger" live>
              {problem}
            </Notice>
          ) : null}
          <div className="row">
            {isPending ? null : (
              <Button variant="ghost" busy={busy === 'draft'} disabled={busy !== null} onClick={() => void save('draft')}>
                Save as draft
              </Button>
            )}
            <Button variant="primary" busy={busy === 'submitted'} disabled={busy !== null} onClick={() => void save('submitted')}>
              {isPending ? 'Save changes' : 'Sign and submit'}
            </Button>
          </div>
        </div>

        <div className="preview" aria-label="Letter preview">
          <div className="preview__bar">
            <span>Live preview · gold marks what you typed</span>
            <Button size="small" variant="ghost" onClick={() => void printLetter(draft, app.db.settings.letter)}>
              Test print / PDF
            </Button>
          </div>
          <div className="preview__stage">
            <ScaledLetter request={draft} settings={app.db.settings.letter} highlight />
          </div>
        </div>
      </div>
    </div>
  );
}
