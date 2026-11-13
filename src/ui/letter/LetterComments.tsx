import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { locateQuote, type NewComment } from '@/core/comments';
import { formatShortDate } from '@/core/dates';
import { COMMENT_MAX, LETTER_BLOCKS, type AbsenceRequest, type LetterBlock, type LetterComment, type LetterSettings } from '@/core/types';
import { Button, Pill } from '../components';
import { ScaledLetter } from './Letter';
import './comments.css';

/**
 * The letter with HR's comments beside it, like Google Docs: the commented
 * words are highlighted on the page and each comment is a card in the margin
 * level with its words. HR (with onAdd) selects words to comment on them.
 *
 * The letter is drawn from the request, so a comment finds its words again by
 * their text (core/comments.ts locateQuote); when the member rewrote them the
 * card says so and nothing is highlighted.
 */

const A4_WIDTH = 794;
/** Below this width the comments go under the letter instead of beside it. */
const NARROW = 620;
const GAP = 8;

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
/** Where words are on the page, in A4 pixels. */
interface Anchor {
  readonly boxes: readonly Box[];
  readonly top: number;
}
interface Picked {
  readonly block: LetterBlock;
  readonly start: number;
  readonly quote: string;
}

/** The DOM range covering characters start…end of a block's text. */
function textRange(blockEl: Element, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const len = node.textContent?.length ?? 0;
    if (!started && start < pos + len) {
      range.setStart(node, start - pos);
      started = true;
    }
    if (started && end <= pos + len) {
      range.setEnd(node, end - pos);
      return range;
    }
    pos += len;
  }
  return null;
}

/** One box per line: a range's rectangles overlap where it covers a whole <span>. */
function mergeBoxes(boxes: Box[]): Box[] {
  const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: Box[] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.y - b.y) < 3 && b.x <= last.x + last.w + 1) {
      const right = Math.max(last.x + last.w, b.x + b.w);
      const bottom = Math.max(last.y + last.h, b.y + b.h);
      out[out.length - 1] = { x: last.x, y: Math.min(last.y, b.y), w: right - last.x, h: bottom - Math.min(last.y, b.y) };
    } else {
      out.push(b);
    }
  }
  return out;
}

function measure(sheet: HTMLElement, block: LetterBlock, start: number, end: number): Anchor | null {
  const el = sheet.querySelector(`[data-block="${block}"]`);
  if (!el) return null;
  const range = textRange(el, start, end);
  if (!range) return null;
  const sheetRect = sheet.getBoundingClientRect();
  const scale = sheetRect.width / A4_WIDTH || 1;
  const boxes = mergeBoxes(
    Array.from(range.getClientRects())
      .filter((r) => r.width > 0.5 && r.height > 0.5)
      .map((r) => ({ x: (r.left - sheetRect.left) / scale, y: (r.top - sheetRect.top) / scale, w: r.width / scale, h: r.height / scale })),
  );
  if (boxes.length === 0) return null;
  return { boxes, top: Math.min(...boxes.map((b) => b.y)) };
}

/** The words selected on the letter, as a block and a place in its text. 'cross': the selection spans two blocks. */
function pickedWords(sheet: HTMLElement): Picked | 'cross' | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!sheet.contains(range.commonAncestorContainer)) return null;
  const blockOf = (n: Node) => (n instanceof Element ? n : n.parentElement)?.closest('[data-block]') ?? null;
  const el = blockOf(range.startContainer);
  if (!el || el !== blockOf(range.endContainer)) return 'cross';
  const block = LETTER_BLOCKS.find((b) => b === el.getAttribute('data-block'));
  if (!block) return 'cross';
  const before = document.createRange();
  before.setStart(el, 0);
  before.setEnd(range.startContainer, range.startOffset);
  const raw = range.toString();
  const quote = raw.trim();
  if (!quote) return null;
  return { block, start: before.toString().length + (raw.length - raw.trimStart().length), quote };
}

const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export interface LetterCommentsProps {
  readonly request: AbsenceRequest;
  readonly settings: LetterSettings;
  /** The comments to show (the screen picks: HR sees its drafts, the member only what was sent). */
  readonly comments: readonly LetterComment[];
  readonly viewer: 'hr' | 'member';
  /** Gold marks on what the member typed. */
  readonly highlight?: boolean | undefined;
  /** Above the letter and the comments: a title, filters. */
  readonly toolbar?: ReactNode;
  /** Shown in the margin when there are no comments to show. */
  readonly emptyText?: string | undefined;
  /** HR, while the letter waits for review: select words, then comment. Each returns true when saved. */
  readonly onAdd?: ((c: NewComment) => Promise<boolean>) | undefined;
  readonly onEdit?: ((id: string, body: string) => Promise<boolean>) | undefined;
  readonly onDelete?: ((id: string) => Promise<boolean>) | undefined;
  readonly onResolve?: ((id: string, resolved: boolean) => Promise<boolean>) | undefined;
  readonly maxWidth?: number | undefined;
}

interface Layout {
  readonly anchors: Readonly<Record<string, Anchor | null>>;
  readonly pending: Anchor | null;
  readonly scale: number;
  /** The sheet's top, measured from the top of the comment rail. */
  readonly offset: number;
  readonly heights: Readonly<Record<string, number>>;
}

const EMPTY: Layout = { anchors: {}, pending: null, scale: 0.6, offset: 0, heights: {} };

export function LetterComments(props: LetterCommentsProps) {
  const { request, settings, comments, viewer, highlight = false, toolbar, emptyText, onAdd, onEdit, onDelete, onResolve, maxWidth } = props;
  const root = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const last = useRef('');
  const [layout, setLayout] = useState<Layout>(EMPTY);
  const [tick, setTick] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [picked, setPicked] = useState<(Picked & { x: number; y: number }) | null>(null);
  const [crossHint, setCrossHint] = useState(false);
  const [composing, setComposing] = useState<Picked | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const showRail = Boolean(onAdd) || comments.length > 0;

  // The letter rescales with the window: measure again whenever the page or the whole box changes size.
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setNarrow((root.current?.clientWidth ?? 1000) < NARROW);
      setTick((t) => t + 1);
    });
    if (root.current) observer.observe(root.current);
    if (page.current) observer.observe(page.current);
    return () => observer.disconnect();
  }, []);

  // After every render (the letter's own fit-to-page runs first): where each comment's words are, and how tall each card is.
  useLayoutEffect(() => {
    const sheet = page.current?.querySelector<HTMLElement>('.a4-sheet');
    if (!sheet) return;
    const anchors: Record<string, Anchor | null> = {};
    for (const c of comments) {
      const text = sheet.querySelector(`[data-block="${c.block}"]`)?.textContent ?? '';
      const at = locateQuote(text, c.quote, c.start);
      anchors[c.id] = at ? measure(sheet, c.block, at.start, at.end) : null;
    }
    const pending = composing ? measure(sheet, composing.block, composing.start, composing.start + composing.quote.length) : null;
    const sheetRect = sheet.getBoundingClientRect();
    const scale = sheetRect.width / A4_WIDTH || 1;
    const offset = rail.current ? sheetRect.top - rail.current.getBoundingClientRect().top : 0;
    const heights: Record<string, number> = {};
    for (const [id, el] of cards.current) heights[id] = el.offsetHeight;
    const next: Layout = { anchors, pending, scale, offset, heights };
    const key = JSON.stringify(next);
    if (key !== last.current) {
      last.current = key;
      setLayout(next);
    }
  });

  const ordered = [...comments].sort((a, b) => (layout.anchors[a.id]?.top ?? Infinity) - (layout.anchors[b.id]?.top ?? Infinity) || a.at.localeCompare(b.at));

  // Cards sit level with their words, pushed down so they never overlap.
  const tops = new Map<string, number>();
  let bottom = -Infinity;
  const place = (id: string, anchor: Anchor | null | undefined) => {
    const want = anchor ? anchor.top * layout.scale + layout.offset : bottom + GAP;
    const top = Math.max(want, bottom + GAP, 0);
    tops.set(id, top);
    bottom = top + (layout.heights[id] ?? 110);
  };
  const items: ({ kind: 'comment'; c: LetterComment } | { kind: 'new' })[] = [];
  for (const c of ordered) {
    if (composing && layout.pending && (layout.anchors[c.id]?.top ?? Infinity) > layout.pending.top && !items.some((i) => i.kind === 'new')) {
      items.push({ kind: 'new' });
      place('__new', layout.pending);
    }
    items.push({ kind: 'comment', c });
    place(c.id, layout.anchors[c.id]);
  }
  if (composing && !items.some((i) => i.kind === 'new')) {
    items.push({ kind: 'new' });
    place('__new', layout.pending);
  }
  const railHeight = Math.max(0, bottom);

  const onMouseUp = () => {
    if (!onAdd) return;
    const sheet = page.current?.querySelector<HTMLElement>('.a4-sheet');
    if (!sheet || !page.current) return;
    const words = pickedWords(sheet);
    setCrossHint(words === 'cross');
    if (!words || words === 'cross') {
      setPicked(null);
      return;
    }
    const rects = window.getSelection()?.getRangeAt(0).getClientRects();
    const end = rects && rects.length > 0 ? rects[rects.length - 1] : null;
    const box = page.current.getBoundingClientRect();
    setPicked({ ...words, x: end ? end.right - box.left : 0, y: end ? end.bottom - box.top + 4 : 0 });
  };

  // A click on highlighted words opens their card.
  const onClick = (e: MouseEvent) => {
    if (window.getSelection()?.isCollapsed === false) return;
    const sheet = page.current?.querySelector<HTMLElement>('.a4-sheet');
    if (!sheet) return;
    const r = sheet.getBoundingClientRect();
    const scale = r.width / A4_WIDTH || 1;
    const x = (e.clientX - r.left) / scale;
    const y = (e.clientY - r.top) / scale;
    const hit = comments.find((c) => layout.anchors[c.id]?.boxes.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y - 2 && y <= b.y + b.h + 2));
    setActive(hit ? hit.id : null);
  };

  const startComment = () => {
    if (!picked) return;
    setComposing({ block: picked.block, start: picked.start, quote: picked.quote });
    setDraft('');
    setPicked(null);
    window.getSelection()?.removeAllRanges();
  };

  const saveNew = async () => {
    if (!composing || !onAdd) return;
    setBusy('__new');
    const ok = await onAdd({ ...composing, body: draft });
    setBusy(null);
    if (ok) {
      setComposing(null);
      setDraft('');
    }
  };

  const act = async (id: string, fn: () => Promise<boolean>) => {
    setBusy(id);
    const ok = await fn();
    setBusy(null);
    return ok;
  };

  const overlay = (
    <>
      {comments.map((c) =>
        layout.anchors[c.id]?.boxes.map((b, i) => (
          <span
            key={`${c.id}-${i}`}
            className={`a4-mark${active === c.id ? ' a4-mark--active' : ''}${c.sentAt ? '' : ' a4-mark--draft'}`}
            style={{ left: b.x - 1, top: b.y, width: b.w + 2, height: b.h }}
          />
        )),
      )}
      {layout.pending?.boxes.map((b, i) => <span key={`new-${i}`} className="a4-mark a4-mark--pending" style={{ left: b.x - 1, top: b.y, width: b.w + 2, height: b.h }} />)}
    </>
  );

  const cardRef = (id: string) => (el: HTMLElement | null) => {
    if (el) cards.current.set(id, el);
    else cards.current.delete(id);
  };
  const cardStyle = (id: string) => (narrow ? undefined : { top: tops.get(id) ?? 0 });

  const composer = composing ? (
    <article key="__new" ref={cardRef('__new')} className="lc-card lc-card--active lc-card--new" style={cardStyle('__new')}>
      <p className="lc-card__quote">“{short(composing.quote)}”</p>
      <textarea
        className="field__textarea"
        rows={3}
        autoFocus
        maxLength={COMMENT_MAX}
        aria-label="Your comment"
        placeholder="What should they change?"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Escape') setComposing(null);
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void saveNew();
        }}
      />
      <div className="row">
        <Button size="small" variant="primary" busy={busy === '__new'} disabled={!draft.trim()} onClick={() => void saveNew()}>
          Comment
        </Button>
        <Button size="small" variant="quiet" onClick={() => setComposing(null)}>
          Cancel
        </Button>
      </div>
    </article>
  ) : null;

  const card = (c: LetterComment) => {
    const changed = layout.anchors[c.id] === null;
    const isEditing = editing?.id === c.id;
    return (
      <article
        key={c.id}
        ref={cardRef(c.id)}
        className={`lc-card${active === c.id ? ' lc-card--active' : ''}${c.resolvedAt ? ' lc-card--resolved' : ''}`}
        style={cardStyle(c.id)}
        onClick={() => setActive(c.id)}
      >
        <header className="lc-card__head">
          <strong className="small">{c.byName}</strong>
          <span className="muted small">{formatShortDate(c.at)}</span>
        </header>
        {viewer === 'hr' && (!c.sentAt || c.resolvedAt || changed) ? (
          <div className="row row--tight">
            {!c.sentAt ? <Pill tone="neutral">Draft · not sent yet</Pill> : null}
            {c.resolvedAt ? <Pill tone="ok">Resolved</Pill> : null}
            {changed && !c.resolvedAt ? <Pill tone="warn">Text changed</Pill> : null}
          </div>
        ) : null}
        <p className={`lc-card__quote${changed ? ' lc-card__quote--gone' : ''}`}>“{short(c.quote)}”</p>
        {isEditing ? (
          <>
            <textarea
              className="field__textarea"
              rows={3}
              autoFocus
              maxLength={COMMENT_MAX}
              aria-label="Edit comment"
              value={editing.body}
              onChange={(e) => setEditing({ id: c.id, body: e.target.value })}
            />
            <div className="row">
              <Button
                size="small"
                variant="primary"
                busy={busy === c.id}
                disabled={!editing.body.trim()}
                onClick={() => void act(c.id, () => onEdit?.(c.id, editing.body) ?? Promise.resolve(false)).then((ok) => ok && setEditing(null))}
              >
                Save
              </Button>
              <Button size="small" variant="quiet" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <p className="lc-card__body">{c.body}</p>
        )}
        {changed && !c.resolvedAt ? (
          <p className="small muted">
            {viewer === 'hr'
              ? 'The member changed these words since you commented.'
              : request.status === 'returned'
                ? 'You changed these words. HR will check them when you resubmit.'
                : 'You changed these words. HR will check them.'}
          </p>
        ) : null}
        {c.resolvedAt ? <p className="small muted">Resolved by {c.resolvedByName ?? 'HR'}.</p> : null}
        {viewer === 'hr' && !isEditing ? (
          <div className="row row--tight">
            {!c.sentAt && onEdit ? (
              <Button size="small" variant="quiet" onClick={() => setEditing({ id: c.id, body: c.body })}>
                Edit
              </Button>
            ) : null}
            {!c.sentAt && onDelete ? (
              <Button size="small" variant="quiet" busy={busy === c.id} onClick={() => void act(c.id, () => onDelete(c.id))}>
                Delete
              </Button>
            ) : null}
            {c.sentAt && onResolve ? (
              <Button size="small" variant="ghost" busy={busy === c.id} onClick={() => void act(c.id, () => onResolve(c.id, !c.resolvedAt))}>
                {c.resolvedAt ? 'Reopen' : 'Resolve'}
              </Button>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  };

  if (!showRail) {
    const letter = <ScaledLetter request={request} settings={settings} highlight={highlight} maxWidth={maxWidth} />;
    return toolbar ? (
      <div className="lc-wrap">
        <div className="lc-toolbar">{toolbar}</div>
        {letter}
      </div>
    ) : (
      letter
    );
  }

  return (
    <div className="lc-wrap" data-tick={tick}>
      {toolbar || onAdd ? (
        <div className="lc-toolbar">
          {toolbar}
          {onAdd ? (
            <span className={`small ${crossHint ? 'lc-hint--warn' : 'muted'}`} role={crossHint ? 'status' : undefined}>
              {crossHint ? 'Select words within one paragraph to comment on them.' : 'Select words on the letter to comment on them.'}
            </span>
          ) : null}
        </div>
      ) : null}
      <div ref={root} className={`lc${narrow ? ' lc--narrow' : ''}`}>
        <div ref={page} className="lc__page" onMouseUp={onMouseUp} onMouseDown={() => setPicked(null)} onClick={onClick}>
          <ScaledLetter request={request} settings={settings} highlight={highlight} overlay={overlay} maxWidth={maxWidth} />
          {picked ? (
            <button
              type="button"
              className="lc-add"
              style={{ left: Math.max(0, picked.x - 40), top: picked.y }}
              onMouseDown={(e) => {
                // Keep the selection, and keep the page from hiding this button before the click lands.
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                startComment();
              }}
            >
              + Comment
            </button>
          ) : null}
        </div>
        <aside ref={rail} className="lc__rail" aria-label="Comments on the letter" style={narrow ? undefined : { minHeight: railHeight }}>
          {comments.length === 0 && !composing ? <p className="small muted lc__empty">{emptyText ?? (onAdd ? 'No comments yet.' : 'No comments.')}</p> : null}
          {items.map((i) => (i.kind === 'new' ? composer : card(i.c)))}
        </aside>
      </div>
    </div>
  );
}
