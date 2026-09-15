# -*- coding: utf-8 -*-
"""Đọc nhánh knockout đồng đội quốc gia (5 hạng mục) từ sporttora.com/pwc2026.
Dùng: curl -sL -A Mozilla https://sporttora.com/pwc2026/delegations -o deleg.html
      PYTHONUTF8=1 python3 wc-team-knockout-parse.py deleg.html [--subs]
Snapshot 08/09/2026 08:56 ICT nằm cạnh file này. Dữ liệu này KHÔNG có trong
wc_open_matches (scraper chỉ nạp vòng bảng Open). Đã dùng cho PR #742."""
import re, json, sys
html = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
s = ''.join(re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, flags=re.S))
s = s.encode('utf-8').decode('unicode_escape').encode('latin1').decode('utf-8')
def grab(i):
    d = 0; j = i
    while True:
        c = s[j]
        if c == '{': d += 1
        elif c == '}':
            d -= 1
            if d == 0: return s[i:j+1]
        elif c == '"':
            j += 1
            while s[j] != '"':
                if s[j] == '\\': j += 1
                j += 1
        j += 1
subs = '--subs' in sys.argv
pat = r'\{"id":"([a-z]+_team_coed____default__m\d+(?:__sub-[A-Z#0-9]+)?)","(?:scores|subLabel)"'
seen = set()
for m in re.finditer(pat, s):
    is_sub = '__sub-' in m.group(1)
    if is_sub != subs: continue
    try: o = json.loads(grab(m.start()))
    except Exception: continue
    if o['id'] in seen or 'scores' not in o: continue
    seen.add(o['id'])
    if o.get('roundName') not in ('Quarterfinal', 'Semifinal', 'Third Place', 'Final'): continue
    ea, eb = (o.get('entryA') or {}), (o.get('entryB') or {})
    w = o.get('winnerId'); win = 'A' if w == ea.get('entryId') else 'B' if w == eb.get('entryId') else '?'
    sc = [(g.get('label', ''), g.get('scoreA'), g.get('scoreB')) for g in o['scores']]
    print(o['id'].split('____')[0], '|', o['roundName'], '|', (o.get('scheduledAt') or '')[:16], '|',
          ea.get('teamName'), 'vs', eb.get('teamName'), '| W:', win, '|', o.get('subLabel', ''), sc)
