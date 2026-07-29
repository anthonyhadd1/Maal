import json
from apps.content.models import Subject, Level

with open('/data/import/pos_to_chapter.json', encoding='utf-8') as f:
    raw = json.load(f)
pos_to_chapter = {}
for k, v in raw.items():
    unit_order, level_order = k.split('_')
    pos_to_chapter[(int(unit_order), int(level_order))] = v

subject = Subject.objects.get(slug='biologie')
levels = Level.objects.filter(unit__subject=subject, unit__is_active=True).select_related('unit')

new_mapping = {}
missing = []
for lvl in levels:
    key = (lvl.unit.order, lvl.order)
    if key not in pos_to_chapter:
        missing.append((lvl.id, key))
        continue
    new_mapping[lvl.id] = pos_to_chapter[key]

print('Total current levels:', levels.count())
print('Mapped:', len(new_mapping))
print('Missing (no position match):', len(missing))
for m in missing[:20]:
    print('  ', m)

with open('/data/import/biologie_chapter_mapping_v2.json', 'w', encoding='utf-8') as f:
    json.dump(new_mapping, f, indent=1)
print('Wrote new mapping with', len(new_mapping), 'entries')
