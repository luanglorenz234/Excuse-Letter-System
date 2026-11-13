/**
 * What arrives from the network, checked before any rule sees it: right
 * types, sensible sizes, known values. Anyone can call the public function,
 * so nothing here trusts the app to have sent what it should.
 */

import type { NewComment } from '@/core/comments';
import type { DraftInput } from '@/core/requests';
import type { LetterSettingsInput } from '@/core/settings';
import { LETTER_BLOCKS, MAX_GROUP_SIZE, type GroupMember, type NotedBy } from '@/core/types';

/** Firestore keeps a document up to 1 MiB; a letter's photo is shrunk to 700,000 characters (SignaturePad.tsx). */
export const MAX_IMAGE = 760_000;
/** A drawn or uploaded signature. */
export const MAX_SIGNATURE = 200_000;
const MAX_TEXT = 200;

export class Invalid extends Error {}

type Loose = Record<string, unknown>;

function obj(v: unknown, what: string): Loose {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Invalid(`${what} is missing.`);
  return v as Loose;
}

function text(v: unknown, what: string, max = MAX_TEXT): string {
  if (typeof v !== 'string') throw new Invalid(`${what} is missing.`);
  if (v.length > max) throw new Invalid(`${what} is too long.`);
  return v;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], what: string): T {
  const found = allowed.find((a) => a === v);
  if (!found) throw new Invalid(`${what} is not one of the choices.`);
  return found;
}

function bool(v: unknown, what: string): boolean {
  if (typeof v !== 'boolean') throw new Invalid(`${what} is missing.`);
  return v;
}

/** '' or yyyy-mm-dd. */
function day(v: unknown, what: string): string {
  const s = text(v, what, 10);
  if (s !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Invalid(`${what} is not a date.`);
  return s;
}

const RASTER = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
/** A URL-encoded or base64 SVG, as the sample signatures are. Only ever shown through <img>, where SVG can't run scripts. */
const SVG = /^data:image\/svg\+xml(;utf8,[^\s<>"]+|;base64,[A-Za-z0-9+/]+={0,2})$/;

/** '' or a PNG/JPEG data URL, as SignaturePad makes them. Signatures may also be SVG. */
function image(v: unknown, what: string, max: number, svg = false): string {
  const s = text(v, what, max);
  if (s !== '' && !RASTER.test(s) && !(svg && SVG.test(s))) throw new Invalid(`${what} is not an image.`);
  return s;
}

function member(v: unknown, i: number): GroupMember {
  const m = obj(v, `Person ${i + 2} on the letter`);
  return {
    // Nobody on a letter has an account now.
    uid: null,
    name: text(m.name, 'A name'),
    internId: text(m.internId ?? '', 'An ID number', 40),
    position: text(m.position ?? '', 'A position'),
    department: text(m.department ?? '', 'A department'),
    memberType: oneOf(m.memberType, ['intern', 'employee'] as const, 'Intern or employee'),
    signature: image(m.signature ?? '', 'A signature', MAX_SIGNATURE, true),
  };
}

export function parseDraftInput(v: unknown): DraftInput {
  const i = obj(v, 'The form');
  const groupMembers = Array.isArray(i.groupMembers) ? i.groupMembers : [];
  if (groupMembers.length > MAX_GROUP_SIZE - 1) throw new Invalid(`A group letter can have at most ${MAX_GROUP_SIZE} people.`);
  return {
    memberType: oneOf(i.memberType, ['intern', 'employee'] as const, 'Intern or employee'),
    name: text(i.name, 'Your name'),
    position: text(i.position ?? '', 'Your position'),
    department: text(i.department, 'Your department'),
    type: oneOf(i.type, ['full', 'half', 'multi'] as const, 'The absence type'),
    date: day(i.date ?? '', 'The date'),
    startDate: day(i.startDate ?? '', 'The start date'),
    endDate: day(i.endDate ?? '', 'The end date'),
    shift: oneOf(i.shift, ['morning', 'afternoon'] as const, 'The shift'),
    timeRange: text(i.timeRange ?? '', 'The time range', 60),
    reasonCategory: text(i.reasonCategory, 'The reason category', 60),
    reasonDetails: text(i.reasonDetails, 'The reason', 2000),
    signatureMethod: oneOf(i.signatureMethod, ['digital', 'wet-upload', 'wet-paper'] as const, 'The signature method'),
    internSignature: image(i.internSignature ?? '', 'Your signature', MAX_SIGNATURE, true),
    wetCopyImage: image(i.wetCopyImage ?? '', 'The photo of the signed letter', MAX_IMAGE),
    groupMode: bool(i.groupMode, 'Just me or group'),
    groupMembers: groupMembers.map(member),
  };
}

export function parseCode(v: unknown): string {
  return text(v, 'The letter code', 20);
}

export function parseId(v: unknown, what = 'The letter'): string {
  const s = text(v, what, 100);
  // A Firestore document id: no slashes, not "." or "..".
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Invalid(`${what} is not valid.`);
  return s;
}

export function parseNewComment(v: unknown): NewComment {
  const c = obj(v, 'The comment');
  const start = c.start;
  if (typeof start !== 'number' || !Number.isFinite(start)) throw new Invalid('Where the words start is missing.');
  return {
    block: oneOf(c.block, LETTER_BLOCKS, 'The part of the letter'),
    quote: text(c.quote, 'The highlighted words', 2000),
    start,
    body: text(c.body, 'The comment', 2000),
  };
}

function notedBy(v: unknown, what: string): NotedBy[] {
  if (!Array.isArray(v) || v.length > 12) throw new Invalid(`${what} is missing.`);
  return v.map((n) => {
    const o = obj(n, what);
    return { name: text(o.name, 'A name'), title: text(o.title, 'A title') };
  });
}

export function parseSettingsInput(v: unknown): LetterSettingsInput {
  const s = obj(v, 'The settings');
  const nb = obj(s.notedBy, 'Noted by');
  return {
    hrOfficerEmail: text(s.hrOfficerEmail, "The HR officer's email"),
    signatoryName: text(s.signatoryName, "The HR officer's name"),
    signatoryTitle: text(s.signatoryTitle, "The HR officer's title"),
    companyName: text(s.companyName, 'The company'),
    subject: text(s.subject, 'The subject'),
    notedBy: { intern: notedBy(nb.intern, 'Noted by on the intern letter'), employee: notedBy(nb.employee, 'Noted by on the employee letter') },
    hrSignature: image(s.hrSignature, 'The HR signature', MAX_SIGNATURE, true),
    attachmentsEnabled: bool(s.attachmentsEnabled, 'Attachments'),
  };
}
