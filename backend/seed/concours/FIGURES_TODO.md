# Questions held out of rotation — figure unavailable

A question that refers to a diagram, graph or photo the app does not have is
unanswerable as printed. Rather than show it, the seed marks it
`"is_active": false` and every session excludes it (`attempts.py` filters on
`is_active`). Attach the figure and flip the flag back to release it — the
importer honours a bare `is_active` change (see `TestInactiveImport`).

**Total: 1** (was 102 on 2026-07-28).

## Still held out

- `biologie-2019-janvier-q5-fm19.p` — "Sur ce schéma d'un chromosome
  métaphasique, éliminer la mauvaise option". Not recoverable: page 2 of
  `Epreuves janvier 2019.pdf` contains **no image and no vector drawing at
  all**. The schema is simply absent from the supplied file, so there is
  nothing to extract; releasing this question would ask a student to read a
  diagram that does not exist. It needs a better scan of that paper.

## Printed in a paper but never imported, and not importable

These are counted separately: they are absent from the seed entirely, not held
out of it. Both are printed in the physique section of *Epreuves janvier 2019*
(pages 50 and 51) and both refer to a figure — an oscillogram and a resistor
network — that the PDF does not contain in any form. They were deliberately
NOT imported rather than imported with an invented answer key, since neither is
solvable from its text alone.

- 2019-janvier physique q6 — "On considère l'oscillogramme ci-contre… La
  fréquence de cette tension a pour valeur :"
- 2019-janvier physique q9 — "On considère l'association des conducteurs
  ohmiques du montage de la figure ci-contre… La résistance équivalente au
  dipôle AB a pour valeur :"

Same fix as above: a scan of that paper with its figures intact.

## What changed

Everything else on the old list of 102 was recovered on 2026-07-29 and is now
live. **185 questions carry a figure** and **23 more have their four answer
options as graphs**; every one of those images was inspected before it was
attached, and the ones that could not be cut cleanly stayed hidden until they
could.

Three extraction modes were needed beyond the original one, because the papers
lay figures out in ways a band anchored on the stem cannot reach:

- **group** — the paper introduces several questions under one printed range
  header ("52-55. Le graphique ci-contre montre…") and prints the figure once
  for all of them, often on the *next* page. Sharing that crop across the range
  is what the source document says to do, not an inference.
- **upward band** — some figures sit above their stem, so the band has to grow
  towards the previous question marker rather than away from it.
- **side column** — many figures are set in a right-hand column that runs past
  where the next question begins, so bounding the crop by the next question
  marker slices the bottom off. Those are bounded by the figure's own geometry
  instead.

The maths "which curve is this?" items needed a fourth path: their ids are
chapter-relative (`math-2026-janvier-ch2-7`) so they carry no question number,
and four questions in one paper share the stem "La courbe représentée est celle
de la fonction:" word for word. They are located by matching their *option
list* against the printed one, position by position.
