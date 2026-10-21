import concurrent.futures, json, re, subprocess, sys, html

UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

def fetch(row):
    seg, url = row
    try:
        p = subprocess.run(
            ["curl","-sS","-A",UA,"-L","--max-redirs","5","--max-time","45",
             "-w","\n@@META@@%{http_code}|%{num_redirects}|%{url_effective}|%{time_total}|%{size_download}",
             url],
            capture_output=True, text=True, timeout=60)
        out = p.stdout
        body, _, meta = out.rpartition("\n@@META@@")
        code, nred, eff, ttot, size = meta.split("|")
    except Exception as e:
        return {"seg":seg,"url":url,"error":str(e)}
    def one(pat, flags=re.I|re.S):
        m = re.search(pat, body, flags)
        return html.unescape(m.group(1).strip()) if m else None
    title = one(r"<title[^>]*>(.*?)</title>")
    desc  = one(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']') or \
            one(r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']')
    canon = one(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\'](.*?)["\']')
    robots= one(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\'](.*?)["\']')
    ogimg = one(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\'](.*?)["\']')
    ogtitle=one(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\'](.*?)["\']')
    lang  = one(r'<html[^>]+lang=["\']([^"\']+)["\']')
    h1s   = [html.unescape(re.sub(r"<[^>]+>","",x).strip()) for x in re.findall(r"<h1[^>]*>(.*?)</h1>", body, re.I|re.S)]
    h2n   = len(re.findall(r"<h2[^>]*>", body, re.I))
    h3n   = len(re.findall(r"<h3[^>]*>", body, re.I))
    hrefl = re.findall(r'<link[^>]+rel=["\']alternate["\'][^>]*hreflang=["\']([^"\']+)["\'][^>]*href=["\']([^"\']+)["\']', body, re.I)
    ld    = re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', body, re.I|re.S)
    types=[]
    ldbad=0
    for b in ld:
        try:
            j=json.loads(b)
            for o in (j if isinstance(j,list) else [j]):
                if isinstance(o,dict):
                    t=o.get("@type")
                    types += t if isinstance(t,list) else [t] if t else []
                    for g in o.get("@graph",[]) or []:
                        if isinstance(g,dict) and g.get("@type"):
                            gt=g["@type"]; types += gt if isinstance(gt,list) else [gt]
        except Exception: ldbad+=1
    # text body
    txt = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>"," ",body,flags=re.I|re.S)
    txt = re.sub(r"<[^>]+>"," ",txt); txt = html.unescape(txt)
    words = len(re.findall(r"\w+", txt))
    imgs = re.findall(r"<img\b[^>]*>", body, re.I)
    noalt = sum(1 for i in imgs if not re.search(r'\balt\s*=', i, re.I))
    return {"seg":seg,"url":url,"status":int(code),"redirects":int(nred),"final":eff,
            "time":float(ttot),"bytes":int(size),"title":title,"title_len":len(title or ""),
            "desc":desc,"desc_len":len(desc or ""),"canonical":canon,"robots":robots,
            "og_image":ogimg,"og_title":ogtitle,"lang":lang,"h1":h1s,"h1_count":len(h1s),
            "h2":h2n,"h3":h3n,"hreflang":hrefl,"schema_types":sorted(set(types)),
            "schema_invalid":ldbad,"words":words,"imgs":len(imgs),"imgs_noalt":noalt}

rows=[l.rstrip("\n").split("\t") for l in open(sys.argv[1])]
res=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
    for i,r in enumerate(ex.map(fetch, rows)):
        res.append(r)
        print(f"{i+1}/{len(rows)} {r.get('status','ERR')} {r['url'][:90]}", file=sys.stderr)
json.dump(res, open(sys.argv[2],"w"), ensure_ascii=False, indent=1)
print(f"wrote {len(res)} -> {sys.argv[2]}")
