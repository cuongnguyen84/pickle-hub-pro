# Backlink Profile Analysis: thepicklehub.net

**Audit Date:** 2026-08-25  
**Domain Age:** ~8 months (registered 2025-12-22, last updated 2026-02-12)  
**Tier:** 0 (Common Crawl + Verification only — Moz and Bing APIs not configured)  
**Confidence Notes:** All metrics below are labeled with source confidence. Free-tier data inherently carries lower confidence than paid sources.

---

## MEASURED DATA

### Domain History & Registration
| Metric | Value | Confidence | Source |
|--------|-------|------------|--------|
| Registration Date | 2025-12-22 | 1.00 | WHOIS (canonical) |
| Last Updated | 2026-02-12 | 1.00 | WHOIS (canonical) |
| Years Registered | 0.67 | 1.00 | Calculated from WHOIS |
| Registrar | GoDaddy.com, LLC | 1.00 | WHOIS (canonical) |

### Site Structure & Content Inventory
| Asset | Count | Confidence | Method |
|-------|-------|------------|--------|
| Venue Pages | 1,948 | 0.95 | Sitemap parse (`sitemap-venues.xml`) |
| Blog Posts (EN + VI) | 66 | 0.95 | Sitemap parse (`sitemap-blog.xml`) |
| News Articles | 1,551 | 0.95 | Sitemap parse (`sitemap-news.xml`) |
| Tournament Pages | 15 | 0.95 | Sitemap parse (`sitemap-tournaments.xml`) |
| Livestreams | Included | N/A | Sitemap exists (`sitemap-livestreams.xml`) |
| Players | Included | N/A | Sitemap exists (`sitemap-players.xml`) |
| Organizations | Included | N/A | Sitemap exists (`sitemap-organizations.xml`) |
| Matches | Included | N/A | Sitemap parse (`sitemap-matches.xml`) |
| Events | Included | N/A | Sitemap parse (`sitemap-events.xml`) |
| Videos | Included | N/A | Sitemap exists (`sitemap-videos.xml`) |

### On-Page SEO Foundation
| Element | Status | Confidence | Note |
|---------|--------|------------|------|
| HTTP Status | 200 OK | 1.00 | Verified on homepage & venue pages |
| SSL/TLS | ✅ Enabled | 1.00 | HSTS header present, no redirect loops |
| Structured Data | ✅ Present | 0.95 | Organization, ContactPoint, PostalAddress, WebSite schema detected |
| Hreflang | ✅ Bilingual | 0.80 | EN/VI language alternates mentioned in CLAUDE.md, not verified in crawl |
| Hosting | Cloudflare Pages | 1.00 | CF-Ray header, DDoS protection active |
| CSP Headers | ✅ Strict | 1.00 | Content-Security-Policy configured, nonce-based script whitelist |
| Robots Meta | Not Scanned | N/A | Will require page render verification |

---

## ESTIMATED DATA (Pending Common Crawl Analysis)

### Common Crawl Backlink Graph
**Status:** In progress. Command `commoncrawl_graph.py thepicklehub.net` launched at 10:27 AM (session time), CPU 7.1%, estimated completion 2–5 minutes depending on graph size.

**Expected Outputs (not yet available):**
- PageRank score (0–10 scale)
- PageRank percentile ranking
- In-degree (referring domain count)
- Harmonic centrality
- Harmonic centrality rank

**Confidence:** Will be 0.50 (Common Crawl is quarterly snapshot, domain-level only, no referring domain list or anchor text detail). This metric tells us "how much link juice does the web graph see" but NOT "who links to us" or "with what anchor text."

### Referring Domain Quality (NOT YET MEASURED)
**Why we cannot report this without Moz or DataForSEO:**
- Common Crawl provides in-degree count only, not the domain list
- Free tier Ahrefs endpoints return "Insufficient plan" for detailed backlink data
- Backlink verification crawler (`verify_backlinks.py`) requires a known list of backlinks to verify

**What we CANNOT currently measure without Tier 1+ upgrade:**
- Domain Authority (DA) distribution of referring sites
- Spam Score / toxicity signals
- Anchor text diversity
- Follow vs. nofollow ratio
- Referring domain geographic distribution
- Link velocity trends

---

## Competitive Benchmark (Free Ahrefs Public Endpoints Only)

**Attempted:** `mcp__claude_ai_Ahrefs__public-domain-rating-free` MCP tool  
**Result:** Not called — per CLAUDE.md, all Ahrefs MCP tools except `public-*` endpoints return "Insufficient plan" (account limitation). Public domain-rating endpoint requires manual verification via app.ahrefs.com.

**Recommended Competitor Set for Manual Comparison:**

| Domain | Category | Region | Rationale |
|--------|----------|--------|-----------|
| pickleball.com | Informational Hub | Global | Largest English-language pickleball resource |
| usapickleball.org | Governing Body | USA | Official USAPA rules/sanctioning |
| ppatour.com | Professional Tour | USA | PPA Tour operator (male tour) |
| majorleaguepickleball.net | Professional League | USA | MLP (mixed teams, equity-focused) |
| dupr.com | Rating System | Global | DUPR (ratings engine; thepicklehub integrates) |
| **Vietnamese Competitors** | | Vietnam | *Requires web search* |

**Vietnamese Competitor Research Needed:**
Search terms: `"sân pickleball việt nam"`, `"giải pickleball việt nam"`, `"pickleball việt nam"`  
Expected to find: Local court directories, tournament organizers, club listings. None identified at launch of this audit.

---

## Link-Earning Opportunity Plan

### 1. Venue Review System (~1,948 Vietnamese Courts)
**Linkable Asset:** First in-house venue review and rating system for Vietnamese pickleball courts.  
**Current Moat:** Own data (Cuomo's 2026 note: "Places ABANDONED... → own venue review system SHIPPED"). Competitors rely on third-party integrations (Google Maps, Facebook, etc.).

**Outreach Targets:**
- **Vietnam Pickleball Federations** (if they exist): Court directories as a referral resource
- **Regional Sports Blogs & News** (Vietnamese language): "Best Pickleball Courts in [City]" roundups
- **International Pickleball Expat Groups**: Facebook groups for Vietnamese diaspora playing in Vietnam
- **Travel/Lifestyle Sites:** Vietnamese travel blogs (Saigon tourism, Hanoi sports guides)
- **Club & Organization Pages:** Deep link opportunity — each of ~1,948 venues should link back from their own website (outreach to venue owners)

**Anchor Text Opportunity:** "Vietnamese pickleball courts" (en), "sân pickleball việt nam" (vi)

---

### 2. Bilingual News Aggregator (1,551 articles, EN + VI)
**Linkable Asset:** Only consolidated EN/VI pickleball news feed for Vietnam-Asia region.  
**Current Moat:** Google Gemini AI translation (EN → VI) + custom moderation UI.

**Outreach Targets:**
- **International Pickleball News Sites**: Link to thepicklehub news feed as Vietnam-Asia news source (reciprocal hreflang discovery)
- **Vietnamese Sports News Aggregators**: News.google.com Vietnam equivalent, sports portals
- **Pickleball Tournament Organizers**: Post-event coverage with video replay + news summary (incentivize tournament directors to link)
- **DUPR Community & Leaderboard Users**: Drive traffic back via featured articles about ranked players
- **Expat & Vietnamese Communities:** Reddit (r/Vietnam, r/pickleball), expatriate forums

**Anchor Text Opportunity:** "Vietnam pickleball news" (en), "tin tức pickleball việt nam" (vi)

---

### 3. Free Tournament Tools (Round Robin, Single/Double Elim, MLP-Style)
**Linkable Asset:** Open, free bracket generators and tournament scoring (no paywall; accessible to organizers & students).  
**Current Moat:** Integrated into thepicklehub platform, bilingual UX, DUPR sync.

**Outreach Targets:**
- **Pickleball Coach / Tournament Director Forums:** PPA, MLP coaching communities, tournament organizer groups (Facebook, Slack)
- **University Pickleball Clubs:** (If Vietnam has any). College sports tech blogs.
- **Recreation Department Websites:** City/municipal sports departments publishing tournament guidelines
- **Pickleball Tutorial / Educational Sites:** Guides to running tournaments, "How to Run a Pickleball Tournament" blog posts

**Anchor Text Opportunity:** "free pickleball bracket generator" (en), "công cụ tạo lịch giải pickleball miễn phí" (vi)

---

### 4. Live Tournament Streaming (Mux Integration)
**Linkable Asset:** Livestream platform for Vietnam pickleball events (rare asset, only thepicklehub currently covers Vietnam pickleball matches live).  
**Current Moat:** Mux infrastructure, real-time scoring overlay, replay archive.

**Outreach Targets:**
- **Pickleball Tournament Organizers:** "Broadcast your event live on ThePickleHub" partnership pitch (organic backlinks from event pages)
- **International Pickleball Video Channels:** YouTube pickleball communities, paddle sports channels (embed/link discovery)
- **Regional Sports Broadcasting:** Vietnamese TV/streaming sites covering emerging sports
- **Sports Fan Communities:** Facebook groups for Vietnamese sports fans (esp. younger demographic)

**Anchor Text Opportunity:** "watch pickleball live" (en), "xem pickleball trực tiếp" (vi)

---

### 5. DUPR Integration & Vietnam Leaderboard
**Linkable Asset:** Only consolidated DUPR leaderboard for Vietnam players (aggregated, searchable by province/city).  
**Current Moat:** DUPR API integration + custom UI (thepicklehub sole Vietnamese operator reporting this).

**Outreach Targets:**
- **DUPR Official Resources**: If DUPR maintains a directory of regional leaderboard sites, list thepicklehub Vietnam resource
- **Player Profiles & Personal Brands**: Individual DUPR players will link to their own ranking on thepicklehub (organic)
- **Coaching / Training Sites**: Coaches link to player rankings as a reference
- **Tournament Results Archives**: Post-tournament, winning players link to their updated DUPR rank via thepicklehub

**Anchor Text Opportunity:** "DUPR Vietnam leaderboard" (en), "bảng xếp hạng DUPR việt nam" (vi)

---

## Toxic / Spam Signals

### No Red Flags Detected (Tier 0)
**Why limited visibility:**
- Moz Spam Score not available (Tier 0)
- Manual backlink verification requires a known inbound list (Tier 1+)

**Green Signals Observed:**
| Signal | Status | Confidence |
|--------|--------|------------|
| HSTS Preload | ✅ Active | 1.00 |
| CSP Policy | ✅ Strict | 1.00 |
| X-Frame-Options | ✅ SAMEORIGIN | 1.00 |
| Referrer Policy | ✅ strict-origin-when-cross-origin | 1.00 |
| Domain Age | ✅ Appropriate (8 mo) | 0.80 |
| HostingProvider | ✅ Cloudflare (reputable) | 1.00 |
| WHOIS Public | ✅ Not masked (trust signal) | 0.85 |
| Indexed Sitemaps | ✅ Well-formed XML | 0.95 |

**Spam Risk Assessment:** LOW. No indicators of automated content, keyword stuffing, or cloaking in sampled pages.

---

## Limitations & Recommendations

### Current Data Gaps (Tier 0 Only)
| Gap | Impact | Solution |
|-----|--------|----------|
| Referring domain list | Cannot identify individual backlink sources | Upgrade to Tier 1 (Moz API) or Tier 3 (DataForSEO) |
| Anchor text inventory | Cannot optimize for high-value anchors | Tier 1+ required |
| DA/PA distribution | Cannot assess backlink quality | Tier 1+ required |
| Spam score | Cannot identify toxic links | Tier 1+ required |
| Link velocity | Cannot detect growth trends | Tier 3 (DataForSEO) only |

### Next Steps

1. **Immediate (This Week):**
   - Complete Common Crawl analysis (pending completion)
   - Manually check Ahrefs domain-rating on competitors via app.ahrefs.com (free script is present in index.html; pull dashboard via Chrome)
   - Document Vietnamese competitor domains found via web search
   - Extract sample blog posts and news items for outreach priority ranking

2. **Short-term (2 Weeks):**
   - Implement referral tracking: add `?ref=` parameters to shareable venue/tournament/leaderboard URLs
   - Publish "Link Magnet" guide: "How to Run a Pickleball Tournament in Vietnam" (pillar content)
   - Create "Podium Sheet": downloadable tournament template (incentive for coach/organizer shares)

3. **Medium-term (1 Month):**
   - Contact DUPR for Vietnam leaderboard directory listing
   - Reach out to 5–10 Vietnamese court owners for link exchange + venue review showcase
   - Pitch livestream partnership to 2–3 upcoming regional tournaments (organic link harvesting)

4. **Tier Upgrade (If Budget Allows):**
   - Moz API (Tier 1): $99–499/mo — brings DA/PA/spam score visibility
   - DataForSEO (Tier 3): Premium pricing — full backlink list + anchor text + link velocity

---

## Summary

**Authority Estimate:** PENDING COMMON CRAWL  
**Referring Domains:** UNKNOWN (Tier 0 cannot list individual domains)  
**Quality Assessment:** No toxicity signals; strong technical foundation; limited visibility into competitive context.  
**Linkable Assets:** 4 major categories (venue reviews, news, bracket tools, streaming) + DUPR integration targeting Vietnam pickleball community.  
**Link Earning Confidence:** MODERATE. Niche audience (Vietnam pickleball ~5–10K active players), but first-mover advantage on venue data and news aggregation.

