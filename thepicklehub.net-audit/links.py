import re, subprocess, sys, json, collections
from urllib.parse import urljoin, urlparse
UA="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
def get(u):
    return subprocess.run(["curl","-sS","-A",UA,"-L","--max-time","45",u],capture_output=True,text=True,timeout=60).stdout
urls=[l.split("\t")[1].strip() for l in open("sample-urls.tsv")]
import random; random.seed(7)
pick=random.sample(urls,30)
rows=[]
for u in pick:
    b=get(u)
    hrefs=re.findall(r'<a\b[^>]*href=["\']([^"\']+)["\']',b,re.I)
    absl=[urljoin(u,h) for h in hrefs]
    internal=[a for a in absl if urlparse(a).netloc.endswith("thepicklehub.net")]
    ext=[a for a in absl if urlparse(a).netloc and not urlparse(a).netloc.endswith("thepicklehub.net")]
    imgs=re.findall(r"<img\b[^>]*>",b,re.I)
    picture=len(re.findall(r"<picture\b",b,re.I))
    rows.append({"url":u,"a_total":len(hrefs),"internal":len(set(internal)),"external":len(set(ext)),
                 "imgs":len(imgs),"picture":picture,
                 "ext_domains":sorted(set(urlparse(a).netloc for a in ext))[:8]})
    print(f"{len(rows)}/30 {u[:80]} a={len(hrefs)} int={len(set(internal))} ext={len(set(ext))} img={len(imgs)}",file=sys.stderr)
json.dump(rows,open("links.json","w"),indent=1,ensure_ascii=False)
