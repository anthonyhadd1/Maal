# -*- coding: utf-8 -*-
"""Locate and crop the figure belonging to each question that references one.

Approach, per question:
  1. find the page + vertical position of the question stem (fuzzy text search),
  2. bound the region: from the stem down to the NEXT question number,
  3. inside that band, union the raster-image rects and the vector-drawing rects,
     discarding page furniture (rules, underlines, borders, header/footer),
  4. render that clip at high DPI.

Nothing here is trusted blind: every crop is written alongside a manifest entry
so a separate pass can check the picture actually matches the question.
"""
import io
import json
import os
import re
import sys
import unicodedata

import fitz

MED = r'C:\Users\Anthon\Desktop\MED'
SEED_DIR = os.path.join(r'C:' + chr(92) + r'Users' + chr(92) + r'Anthon',
                        'Desktop', 'Maal', 'backend', 'seed', 'concours')
OUT = 'crops'
PAGES = 'pages'

# exam key -> source PDF
PDFS = {
    '2020-juillet': 'EPREUVES JUILLET  2020.pdf',
    '2023-janvier': 'Epreuves Janvier 2023.pdf',
    '2024-janvier': 'Epreuves Janvier 2024.pdf',
    '2022-juillet': 'Epreuves Juillet 2022.pdf',
    '2023-juillet': 'Epreuves Juillet 2023.pdf',
    '2021-juin': 'Epreuves Juin 2021.pdf',
    '2021-mars': 'Epreuves Mars 2021.pdf',
    '2020-janvier': 'Epreuves janvier 2020.pdf',
    '2025-janvier': 'epreuves-janvier-2025.pdf',
    '2026-janvier': 'epreuves-janvier-2026.pdf',
    '2016-fevrier': 'fm16.pdf',
    '2017-fevrier': 'fm17.pdf',
    '2018-fevrier': 'fm18.pdf',
    '2019-janvier': 'fm19.pdf',
    '2024-juillet': 'juillet2024.pdf',
    '2011-janvier': 'fm11.pdf',
}

# "La figure de style qui consiste à..." is rhetoric, not a diagram.
FALSE_POSITIVE = re.compile(r'figures? de style', re.I)
# "dans le schéma de la Q42" / "la figure de la question 95" — the picture
# belongs to ANOTHER question and must be reused, not re-cropped.
SHARED_REF = re.compile(
    r'(?:sch[ée]ma|figure|graphe|document|tableau|courbe)s?\s+(?:de la\s+)?Q\.?\s*(\d+)'
    r'|question\s+(\d+)', re.I)
# "le graphique précédent", "le circuit de la question précédente" — the figure
# belongs to the question immediately before this one.
PREV_REF = re.compile(
    r'(?:sch[ée]ma|figure|graphe|graphique|document|tableau|courbe|circuit)\s*'
    r'(?:de la question\s+)?pr[ée]c[ée]dente?', re.I)

ZOOM = 3.0
PAD = 14.0
MIN_FIG_AREA = 2400.0     # pt^2 — below this it is a rule, tick or glyph box
MIN_FIG_SIDE = 40.0       # pt   — a figure is never a 6pt sliver
HEADER_BAND = 56.0        # pt from the top: running head
FOOTER_BAND = 24.0        # pt from the bottom: page number only.
                          # 46 was clipping figures that sit low on the page.


def norm(s):
    """Fold accents/whitespace so PDF text and DB text compare cleanly."""
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.replace('\u2019', "'").replace('\u2018', "'")
    s = re.sub(r'\s+', ' ', s)
    return s.lower().strip()


_doc_cache = {}


def load(exam):
    name = PDFS.get(exam)
    if not name:
        return None
    path = os.path.join(MED, name)
    if not os.path.exists(path):
        return None
    if path not in _doc_cache:
        _doc_cache[path] = fitz.open(path)
    return _doc_cache[path]


def page_texts(doc):
    key = id(doc)
    if key not in _doc_cache.setdefault('_txt', {}):
        _doc_cache['_txt'][key] = [norm(p.get_text()) for p in doc]
    return _doc_cache['_txt'][key]


def number_rect(page, qnum):
    """Rect of the line that begins with '<qnum>.' — the printed question
    marker. The DB text was normalised on import (ligatures, spacing, editorial
    annotations), so an exact text search misses on a third of the papers; the
    number is stable."""
    if qnum is None:
        return None
    pat = re.compile(rf'^\s*{qnum}\s*[.)-]')
    for b in page.get_text('dict')['blocks']:
        if b.get('type') != 0:
            continue
        for line in b['lines']:
            spans = line.get('spans') or []
            if spans and pat.match((spans[0].get('text') or '')):
                return fitz.Rect(line['bbox'])
    return None


def find_page(doc, text, qnum=None):
    """Page holding this question.

    Matching on the stem alone is not enough: several papers word two questions
    almost identically ("En utilisant les données de la figure...", "Le tableau
    périodique comprend :"), and taking the first hit put the crop on the wrong
    page entirely. When more than one page matches, the printed question NUMBER
    breaks the tie.
    """
    target = norm(text)
    texts = page_texts(doc)
    for length in (90, 60, 40, 28):
        probe = target[:length]
        if len(probe) < 20:
            continue
        hits = [i for i, t in enumerate(texts) if probe in t]
        if not hits:
            continue
        if len(hits) == 1:
            return hits[0], length
        if qnum is not None:
            numbered = [i for i in hits if number_rect(doc[i], qnum) is not None]
            if len(numbered) == 1:
                return numbered[0], length
            if numbered:
                hits = numbered
        # Still ambiguous — refuse rather than guess a page at random.
        return (hits[0], length) if length >= 60 else (None, 0)
    return None, 0


def stem_rect(page, text):
    """Bounding rect of the question stem on the page, or None."""
    target = norm(text)
    for length in (70, 45, 30):
        probe = target[:length]
        if len(probe) < 18:
            continue
        # search_for wants the raw string; try the original slice first.
        raw = re.sub(r'\s+', ' ', (text or '').strip())[:length]
        rects = page.search_for(raw)
        if rects:
            r = rects[0]
            for extra in rects[1:]:
                r |= extra
            return r
    return None


def prev_question_y(page, before_y):
    """Y of the nearest '<n>.' question marker ABOVE `before_y`."""
    best = None
    for b in page.get_text('dict')['blocks']:
        if b.get('type') != 0:
            continue
        for line in b['lines']:
            spans = line.get('spans') or []
            if not spans:
                continue
            head = (spans[0].get('text') or '').strip()
            if not re.match(r'^\d{1,3}\s*[.)-]', head):
                continue
            y = line['bbox'][3]
            if y < before_y - 4 and (best is None or y > best):
                best = y
    return best


def next_question_y(page, after_y):
    """Y of the next '<n>.' / '<n>)' question marker below `after_y`."""
    best = None
    for b in page.get_text('dict')['blocks']:
        if b.get('type') != 0:
            continue
        for line in b['lines']:
            spans = line.get('spans') or []
            if not spans:
                continue
            head = (spans[0].get('text') or '').strip()
            if not re.match(r'^\d{1,3}\s*[.)-]', head):
                continue
            y = line['bbox'][1]
            if y > after_y + 6 and (best is None or y < best):
                best = y
    return best


def is_furniture(rect, page_rect):
    w, h = rect.width, rect.height
    if w < MIN_FIG_SIDE or h < MIN_FIG_SIDE:
        return True
    if w * h < MIN_FIG_AREA:
        return True
    # Full-width, short: a horizontal rule or table border.
    if w > page_rect.width * 0.92 and h < 24:
        return True
    # Nearly the whole page: a page frame, not a figure.
    if w > page_rect.width * 0.95 and h > page_rect.height * 0.9:
        return True
    return False


def cluster(rects, gap=46.0):
    """Group rects into connected clusters (union-find on proximity)."""
    n = len(rects)
    parent = list(range(n))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for i in range(n):
        gi = fitz.Rect(rects[i]) + (-gap, -gap, gap, gap)
        for j in range(i + 1, n):
            if gi.intersects(rects[j]):
                union(i, j)

    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(rects[i])
    out = []
    for members in groups.values():
        u = members[0]
        for r in members[1:]:
            u |= r
        out.append((u, len(members)))
    return out


def text_rects(page):
    """Bounding rects of every text line — used to reject line decoration."""
    out = []
    for b in page.get_text('dict')['blocks']:
        if b.get('type') != 0:
            continue
        for line in b['lines']:
            out.append(fitz.Rect(line['bbox']))
    return out


def mostly_text(rect, texts):
    """True only for genuine text decoration — an underline or strike-through.

    The first version dropped any rect that sat 60% inside a text line's box,
    which silently deleted a circuit's bottom RAIL: a 1pt-tall wire lies
    entirely inside whatever line box it crosses, so it scored 100% and the
    circuit came out open at the bottom. A real underline is thin AND
    horizontally contained by its line; a rail is not.
    """
    if rect.height > 3.5:
        return False
    for t in texts:
        if rect.x0 >= t.x0 - 4 and rect.x1 <= t.x1 + 4 and t.y0 - 4 <= rect.y0 <= t.y1 + 4:
            return True
    return False


def figure_rect(page, top, bottom, stem):
    """The figure belonging to THIS question, inside the [top, bottom] band.

    Clusters the geometry instead of unioning everything in the band. A naive
    union merged a neighbouring question's diagram, its stem and its answer
    choices into one crop — leaking the answers and showing the wrong figure.
    Among the candidate clusters, the one vertically closest to the stem wins.
    """
    pr = page.rect
    band_top = max(top, pr.y0 + HEADER_BAND)
    band_bottom = min(bottom, pr.y1 - FOOTER_BAND)
    if band_bottom - band_top < MIN_FIG_SIDE:
        return None, 0

    raster = []
    for info in page.get_image_info():
        r = fitz.Rect(info['bbox'])
        if r.y0 >= band_top - 4 and r.y1 <= band_bottom + 4 and not is_furniture(r, pr):
            raster.append(r)

    texts = text_rects(page)
    vec = []
    for d in page.get_drawings():
        r = fitz.Rect(d['rect'])
        if r.y0 < band_top - 4 or r.y1 > band_bottom + 4:
            continue
        if r.width < 3 and r.height < 3:
            continue
        if r.width > pr.width * 0.92 and r.height < 20:
            continue
        if mostly_text(r, texts):
            continue
        vec.append(r)

    candidates = [(r, 1) for r in raster]
    for u, count in cluster(vec):
        if count >= 4 and not is_furniture(u, pr):
            candidates.append((u, count))

    if not candidates:
        return None, 0

    # Closest to the stem wins; ties broken by area (the fuller figure).
    def score(item):
        r = item[0]
        mid = (r.y0 + r.y1) / 2
        dist = abs(mid - ((stem.y0 + stem.y1) / 2 if stem else band_top))
        return (dist, -(r.width * r.height))

    best = min(candidates, key=score)[0]

    # Absorb companion pieces of the SAME figure: a second panel stacked under
    # the first, or the vector axes belonging to a raster plot. Vertical growth
    # is allowed generously (multi-panel figures were being cut in half); the
    # band clamp below is what stops it reaching a neighbouring question.
    out = fitz.Rect(best)
    for _ in range(3):
        grew = False
        for r, _n in candidates:
            if out.contains(r):
                continue
            near = fitz.Rect(out) + (-30, -46, 30, 46)
            if not near.intersects(r):
                continue
            merged = fitz.Rect(out) | r
            # Horizontal growth stays tight (sideways = a different column, i.e.
            # usually the text); vertical growth is what multi-panel needs.
            if merged.width <= max(out.width * 1.6, out.width + 60):
                out = merged
                grew = True
        if not grew:
            break

    # Pull in labels that belong to the drawing ("R1 = 10 Ω", axis units): text
    # lines that sit within the figure's horizontal span and touch it.
    for t in texts:
        if t.y1 < band_top or t.y0 > band_bottom:
            continue
        near = fitz.Rect(out) + (-10, -12, 10, 12)
        if not near.intersects(t):
            continue
        # Only a label — a full-width paragraph is the stem or the choices.
        if t.width > out.width * 1.15 or t.width > pr.width * 0.55:
            continue
        out |= t

    out = fitz.Rect(out.x0 - PAD, out.y0 - PAD, out.x1 + PAD, out.y1 + PAD) & pr
    # Hard clamp: never spill past this question's own band. This is what stops
    # a crop swallowing the next question's stem or this one's answer list.
    out.y0 = max(out.y0, band_top)
    out.y1 = min(out.y1, band_bottom)
    if is_furniture(out, pr):
        return None, 0
    return out, len(candidates)


def main():
    data = json.load(io.open('needfig.json', encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PAGES, exist_ok=True)

    manifest, misses, shared = [], [], []
    for q in data:
        if FALSE_POSITIVE.search(q['text']):
            misses.append({**q, 'why': 'not a diagram (rhetorical "figure de style")'})
            continue
        m = SHARED_REF.search(q['text'])
        if m:
            shared.append({**q, 'source_qnum': int(m.group(1) or m.group(2))})
            continue
        if PREV_REF.search(q['text']):
            mine = re.search(r'-q(\d+)-', q['ref'])
            if mine:
                shared.append({**q, 'source_qnum': int(mine.group(1)) - 1})
                continue
        exam = q.get('exam')
        if not exam:
            misses.append({**q, 'why': 'no exam (synthetic specialite)'})
            continue
        doc = load(exam)
        if doc is None:
            misses.append({**q, 'why': f'no PDF mapped for {exam}'})
            continue

        qn0 = re.search(r'-q(\d+)-', q['ref'])
        qnum0 = int(qn0.group(1)) if qn0 else None
        pno, _ = find_page(doc, q['text'], qnum0)
        if pno is None:
            misses.append({**q, 'why': 'stem not found in PDF'})
            continue
        page = doc[pno]

        sr = stem_rect(page, q['text']) or number_rect(page, qnum0)
        stem_top = sr.y0 if sr else page.rect.y0 + HEADER_BAND
        stem_bottom = sr.y1 if sr else page.rect.y0 + HEADER_BAND
        nxt = next_question_y(page, stem_bottom)
        bottom = nxt if nxt else page.rect.y1 - FOOTER_BAND

        # Below the stem first — the usual layout. Some papers put the figure
        # ABOVE its question, so fall back to the whole band bounded by the
        # previous question marker (never wider, or we steal a neighbour's).
        # From the TOP of the stem (figures often sit beside it, at the same y)
        # down to the next question marker — never further, or the crop steals
        # the previous question's diagram, text and answer choices.
        rect, nparts = figure_rect(page, stem_top - 6, bottom, sr)
        if rect is None:
            # Some papers print the figure ABOVE its question. Bound the search
            # by the PREVIOUS question marker so it stays inside this question.
            prev = prev_question_y(page, stem_top)
            if prev is not None:
                rect, nparts = figure_rect(page, prev, bottom, sr)
        if rect is None:
            misses.append({**q, 'why': 'no figure geometry in band', 'page': pno + 1})
            continue

        name = f"{q['ref']}.png".replace('/', '_')
        pix = page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), clip=rect)
        pix.save(os.path.join(OUT, name))

        # Full page too, so a checker can see the figure in context.
        pname = f"{exam}-p{pno + 1}.png"
        ppath = os.path.join(PAGES, pname)
        if not os.path.exists(ppath):
            doc[pno].get_pixmap(matrix=fitz.Matrix(2.0, 2.0)).save(ppath)

        manifest.append({
            'ref': q['ref'], 'subject': q['subject'], 'exam': exam,
            'page': pno + 1, 'crop': f'{OUT}/{name}', 'page_png': f'{PAGES}/{pname}',
            'parts': nparts, 'w': round(rect.width, 1), 'h': round(rect.height, 1),
            'text': q['text'][:220],
        })

    # Questions that point at another question's picture: reuse that crop.
    # Also consider figures attached in an EARLIER run — those questions are no
    # longer in needfig.json, so this run produced no crop of its own for them.
    import glob as _glob
    existing = {}
    for sp in _glob.glob(os.path.join(SEED_DIR, '*.json')):
        try:
            sd = json.load(io.open(sp, encoding='utf-8'))
        except Exception:
            continue
        stack = [sd]
        while stack:
            n = stack.pop()
            if isinstance(n, dict):
                if 'external_id' in n and 'choices' in n:
                    if n.get('image'):
                        existing[n['external_id']] = n['image']
                    continue
                stack.extend(n.values())
            elif isinstance(n, list):
                stack.extend(n)

    by_key = {}
    for e in manifest:
        mm = re.search(r'-q(\d+)-', e['ref']) or re.search(r'-(\d+)$', e['ref'])
        if mm:
            by_key[(e['subject'], e['exam'], int(mm.group(1)))] = e
    resolved = 0
    for ref, img in existing.items():
        mm = re.search(r'-q(\d+)-', ref)
        if not mm:
            continue
        subj = ref.split('-')[0].replace('_', '-')
        by_key.setdefault((subj, None, int(mm.group(1))), {'ref': ref, 'seed_image': img})

    for q in shared:
        src = by_key.get((q['subject'], q['exam'], q['source_qnum']))
        if src is None:
            src = by_key.get((q['subject'], None, q['source_qnum']))
        if src is not None and 'seed_image' in src:
            manifest.append({'ref': q['ref'], 'subject': q['subject'], 'exam': q['exam'],
                             'reuse_seed_image': src['seed_image'], 'shared_from': src['ref'],
                             'text': q['text'][:220], 'crop': None, 'page_png': None,
                             'parts': 0, 'w': 0, 'h': 0})
            resolved += 1
            continue
        if src is None:
            misses.append({**q, 'why': f"shared figure: Q{q['source_qnum']} has no crop"})
            continue
        manifest.append({**src, 'ref': q['ref'], 'text': q['text'][:220],
                         'shared_from': src['ref']})
        resolved += 1
    print(f'shared reused: {resolved} of {len(shared)}')

    io.open('manifest.json', 'w', encoding='utf-8').write(
        json.dumps(manifest, ensure_ascii=False, indent=1))
    io.open('misses.json', 'w', encoding='utf-8').write(
        json.dumps(misses, ensure_ascii=False, indent=1))

    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print(f'cropped : {len(manifest)}')
    print(f'missed  : {len(misses)}')
    from collections import Counter
    for why, n in Counter(m['why'] for m in misses).most_common():
        print(f'   {why:<40} {n}')


if __name__ == '__main__':
    main()
