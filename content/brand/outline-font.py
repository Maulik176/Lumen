"""Outline a word in Young Serif as one SVG path (font units, y up flipped to y down), with kerning."""
import json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

font = TTFont(sys.argv[1])
word = sys.argv[2]
cmap = font.getBestCmap()
glyphs = font.getGlyphSet()
hmtx = font['hmtx']
upm = font['head'].unitsPerEm
os2 = font['OS/2']
kern = {}
if 'GPOS' in font:
    # Pair adjustments from GPOS PairPos format 1 only (enough for a short word; format 2 checked below).
    for lookup in font['GPOS'].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            st = sub.ExtSubTable if lookup.LookupType == 9 else sub
            if getattr(st, 'LookupType', lookup.LookupType) != 2 and lookup.LookupType not in (2, 9):
                continue
            if not hasattr(st, 'Format'):
                continue
            if st.Format == 1:
                cov = st.Coverage.glyphs
                for i, first in enumerate(cov):
                    for rec in st.PairSet[i].PairValueRecord:
                        v = rec.Value1.XAdvance if rec.Value1 and hasattr(rec.Value1, 'XAdvance') else 0
                        kern.setdefault((first, rec.SecondGlyph), v)
            elif st.Format == 2:
                cov = set(st.Coverage.glyphs)
                c1 = st.ClassDef1.classDefs
                c2 = st.ClassDef2.classDefs
                names = [cmap[ord(ch)] for ch in word]
                for a, b in zip(names, names[1:]):
                    if a in cov and (a, b) not in kern:
                        rec = st.Class1Record[c1.get(a, 0)].Class2Record[c2.get(b, 0)]
                        v = rec.Value1.XAdvance if rec.Value1 and hasattr(rec.Value1, 'XAdvance') else 0
                        if v:
                            kern[(a, b)] = v
x = 0
parts = []
names = [cmap[ord(ch)] for ch in word]
for i, name in enumerate(names):
    pen = SVGPathPen(glyphs)
    glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
    parts.append(pen.getCommands())
    x += hmtx[name][0]
    if i + 1 < len(names):
        x += kern.get((name, names[i + 1]), 0)
print(json.dumps({
    'upm': upm, 'advance': x, 'path': ' '.join(parts),
    'capHeight': getattr(os2, 'sCapHeight', 0), 'xHeight': getattr(os2, 'sxHeight', 0),
    'ascender': font['hhea'].ascent, 'descender': font['hhea'].descent,
    'kerned': [f'{a}-{b}:{v}' for (a, b), v in kern.items() if a in names and b in names],
}))
