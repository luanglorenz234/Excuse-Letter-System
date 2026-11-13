import { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { memberComments } from '@/core/comments';
import { addDaysYmd, minFilingDate, todayYmd } from '@/core/dates';
import { DEFAULT_TIME_RANGE, buildDraft, canRevise, inputFrom, type DraftInput } from '@/core/requests';
import { MAX_GROUP_SIZE, REASON_CATEGORIES, REASON_MAX, REASON_MIN, type AbsenceRequest, type AbsenceType, type GroupMember, type MemberType, type SignatureMethod } from '@/core/types';
import type { LetterReply } from '@/server/handlers';
import { Button, Card, Notice, TextInput } from '../components';
import { safeImageSrc } from '../letter/Letter';
import { LetterComments } from '../letter/LetterComments';
import { printLetter } from '../letter/print';
import { PageHeader } from '../App';
import { SignaturePad, compressImageFile } from '../SignaturePad';
import { useApp } from '../state/AppState';
import { paths } from '../state/paths';
import { LetterPlaceholder, useLetter, type LetterState } from './LetterScreen';

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

/** The absence form: interns and employees, no account. */
export function FormScreen() {
  return <RequestForm key="new" existing={null} />;
}

/** Changing a letter opened with its code, while HR hasn't decided or after HR returned it. */
export function EditLetterScreen() {
  const { code = '' } = useParams();
  const location = useLocation();
  const [load, , retry] = useLetter(code, (location.state as LetterState | null)?.letter);
  if (load.state !== 'ready') return <LetterPlaceholder load={load} retry={retry} />;
  const existing = load.letter;
  if (!canRevise(existing)) return <Navigate to={paths.letter(code)} replace state={{ letter: existing } satisfies LetterState} />;
  return <RequestForm key={existing.id} existing={existing} />;
}

/**
 * The form on the left, the live letter on the right. Nobody filing has an
 * account: they type their name and department, and get a code for the letter.
 */
function RequestForm({ existing }: { existing: AbsenceRequest | null }) {
  const app = useApp();
  const navigate = useNavigate();
  const tomorrow = addDaysYmd(todayYmd(), 1);
  const [input, setInput] = useState<DraftInput>(() => inputFrom(existing, tomorrow, addDaysYmd(tomorrow, 1)));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const set = <K extends keyof DraftInput>(key: K, value: DraftInput[K]) => setInput((cur) => ({ ...cur, [key]: value }));
  const setMember = (i: number, patch: Partial<GroupMember>) =>
    setInput((cur) => ({ ...cur, groupMembers: cur.groupMembers.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  // Everyone on a letter is the same kind: the letter's wording is for interns or for employees.
  const setMemberType = (memberType: MemberType) => setInput((cur) => ({ ...cur, memberType, groupMembers: cur.groupMembers.map((m) => ({ ...m, memberType })) }));

  const draft = useMemo(() => buildDraft(input, existing, new Date()), [input, existing]);
  const comments = useMemo(() => (existing ? memberComments(existing) : []), [existing]);
  const isPending = existing?.status === 'submitted';
  const employee = input.memberType === 'employee';
  const reasonLen = input.reasonDetails.trim().length;
  const minDate = minFilingDate();
  const digital = input.signatureMethod === 'digital';
  const full = input.groupMembers.length + 1 >= MAX_GROUP_SIZE;
  const back = existing?.accessCode ? paths.letter(existing.accessCode) : paths.home;

  const addPerson = () => {
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

  const send = async () => {
    setBusy(true);
    const reply = existing?.accessCode
      ? await app.call<LetterReply>({ action: 'revise', code: existing.accessCode, input })
      : await app.call<LetterReply>({ action: 'submit', input });
    setBusy(false);
    if (!reply.ok) {
      setProblem(reply.error);
      return;
    }
    setProblem(null);
    app.notify(reply.message);
    navigate(paths.letter(reply.value.code), { state: { letter: reply.value.letter, fresh: !existing } satisfies LetterState });
  };

  const title = isPending ? 'Change your letter' : existing ? 'Revise your letter' : 'Absence form';

  return (
    <div className="page page--wide">
      <PageHeader
        title={title}
        subtitle="No account needed. Fill in your details; the official letter on the right updates as you type."
        actions={
          <Button variant="ghost" onClick={() => navigate(back)}>
            Back
          </Button>
        }
      />

      {existing?.status === 'returned' && existing.review ? (
        <Notice tone="warn" title={`Returned for revision by ${existing.review.byName}`}>
          {comments.length > 0 ? `HR left ${comments.length} comment${comments.length === 1 ? '' : 's'} on the letter, highlighted on the right. ` : null}
          {existing.review.remarks && !/^Returned with \d+ comments?/.test(existing.review.remarks) ? `HR remarks: "${existing.review.remarks}"` : null}
        </Notice>
      ) : null}
      {isPending ? (
        <Notice tone="info">This letter is still waiting for HR. Your changes replace the version HR sees. Once HR decides on it, it can no longer be edited.</Notice>
      ) : null}

      <div className="workspace">
        <div className="stack">
          <Card
            title="1. Your details"
            description={employee ? 'Your name and position print on the letter. Your department is for HR.' : 'Your name prints on the letter. Your department is for HR.'}
          >
            <div className="stack">
              <div className="field">
                <span className="field__label">Intern or employee?</span>
                <Segmented<MemberType>
                  label="Intern or employee?"
                  value={input.memberType}
                  options={[
                    ['intern', 'Intern'],
                    ['employee', 'Employee'],
                  ]}
                  onChange={setMemberType}
                />
                <span className="field__hint">Picks the letter's wording and who notes it.</span>
              </div>
              <div className="grid-2">
                <TextInput label="Full name" value={input.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" placeholder="e.g. Juan A. Dela Cruz" required />
                {employee ? (
                  <TextInput label="Position" value={input.position} onChange={(e) => set('position', e.target.value)} placeholder="e.g. Operations Associate" required />
                ) : null}
                <TextInput label="Department" value={input.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. Information Technology" required />
              </div>
            </div>
          </Card>

          <Card title="2. Absence details">
            <div className="stack">
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
                        <div className="stack stack--tight" style={{ flex: 1 }}>
                          <input className="field__input" placeholder="Full name *" aria-label="Full name" value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} />
                          {employee ? (
                            <input className="field__input" placeholder="Position" aria-label="Position" value={m.position} onChange={(e) => setMember(i, { position: e.target.value })} />
                          ) : null}
                          <input
                            className="field__input"
                            placeholder="Department (blank: same as yours)"
                            aria-label="Department"
                            value={m.department}
                            onChange={(e) => setMember(i, { department: e.target.value })}
                          />
                        </div>
                        <Button size="small" variant="ghost" onClick={() => set('groupMembers', input.groupMembers.filter((_, j) => j !== i))}>
                          Remove
                        </Button>
                      </div>
                      {digital ? <SignaturePad small label={m.name || 'This person'} value={m.signature} onChange={(sig) => setMember(i, { signature: sig })} /> : null}
                    </div>
                  ))}
                  <div>
                    <Button size="small" variant="ghost" onClick={addPerson}>
                      Add a person
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

          <Card title="3. Signature" description="Choose how you will sign.">
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
                <SignaturePad label="Your signature" value={input.internSignature} onChange={(sig) => set('internSignature', sig)} allowUpload />
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
            <Button variant="primary" busy={busy} onClick={() => void send()}>
              {isPending ? 'Save changes' : existing?.status === 'returned' ? 'Sign and resubmit' : 'Sign and submit'}
            </Button>
          </div>
          {!existing ? <p className="small muted">After you submit you get a letter code. Write it down: it is the only way back to your letter.</p> : null}
        </div>

        <div className="preview" aria-label="Letter preview">
          <div className="preview__bar">
            <span>Live preview · gold marks what you typed{comments.length > 0 ? ' · yellow marks HR comments' : ''}</span>
            <Button size="small" variant="ghost" onClick={() => void printLetter(draft, app.db.settings.letter)}>
              Test print / PDF
            </Button>
          </div>
          <div className="preview__stage">
            <LetterComments request={draft} settings={app.db.settings.letter} comments={comments} viewer="member" highlight />
          </div>
        </div>
      </div>
    </div>
  );
}
