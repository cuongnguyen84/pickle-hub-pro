#!/usr/bin/env node
// Gates cho native bilingual migration (proposal native-bilingual, increment 4).
// Chạy local hoặc CI. Ba subcommand:
//
//   node scripts/native-i18n-gates.mjs duplicates   # chuỗi VI ở >=2 file phải nằm trong allowlist
//   node scripts/native-i18n-gates.mjs specifiers   # % specifier bản EN phải khớp key nguồn
//   node scripts/native-i18n-gates.mjs coverage [--max N]  # đếm literal VI chưa vào catalog
//
// Giới hạn đã biết (ghi trong proposal §4 inc.4): gate nhìn LITERAL trong source —
// mù với chữ Việt do Foundation sinh runtime (formatter ghim vi_VN). Lớp đó do
// job CI -testLanguage en + screenshot 2 locale bắt.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const APP_DIR = join(ROOT, "apple/ThePickleHub");
const CATALOG = join(APP_DIR, "Resources/Localizable.xcstrings");
const ALLOWLIST = join(ROOT, "apple/i18n-duplicate-allowlist.txt");

const VI_RE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;

function swiftFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...swiftFiles(p));
    else if (name.endsWith(".swift")) out.push(p);
  }
  return out;
}

// Trích string literal một dòng (đủ cho codebase này — literal nhiều dòng """ hiếm
// và không chứa copy UI). Bỏ dòng comment //. Interpolation giữ nguyên văn.
function literalsIn(src) {
  const found = [];
  for (const rawLine of src.split("\n")) {
    const line = rawLine.replace(/^\s*\/\/.*/, "");
    // match "..." tôn trọng escape \" và interpolation \( ... "..." ... )
    const re = /"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (VI_RE.test(m[1])) found.push(m[1]);
    }
  }
  return found;
}

function specifiersOf(s) {
  // %% là literal percent; còn lại: %@ %lld %d %.2f %1$@ ...
  // Flag class KHÔNG chứa dấu cách/quote: "75% of players" từng bị đọc nhầm thành %o (false positive)
  return (s.match(/%(?:\d+\$)?[#0\-+]*[\d.]*(?:hh|h|ll|l|q|z|t|j)?[@dDuUxXoOfeEgGcCsSpaAF]/g) ?? []);
}

function loadCatalog() {
  return JSON.parse(readFileSync(CATALOG, "utf8"));
}

const cmd = process.argv[2];
let failed = false;

if (cmd === "duplicates") {
  const byLiteral = new Map();
  for (const f of swiftFiles(APP_DIR)) {
    const rel = f.slice(ROOT.length);
    for (const lit of new Set(literalsIn(readFileSync(f, "utf8")))) {
      if (!byLiteral.has(lit)) byLiteral.set(lit, new Set());
      byLiteral.get(lit).add(rel);
    }
  }
  const allow = existsSync(ALLOWLIST)
    ? new Set(readFileSync(ALLOWLIST, "utf8").split("\n").filter((l) => l && !l.startsWith("#")))
    : new Set();
  const offenders = [...byLiteral.entries()]
    .filter(([lit, files]) => files.size >= 2 && !allow.has(lit))
    .sort((a, b) => b[1].size - a[1].size);
  if (offenders.length) {
    console.error(`✗ ${offenders.length} chuỗi VI xuất hiện ở >=2 file NGOÀI allowlist (${ALLOWLIST.slice(ROOT.length)}):`);
    for (const [lit, files] of offenders) console.error(`  "${lit}" — ${[...files].join(", ")}`);
    console.error("→ Mỗi chuỗi: hoặc Cuong duyệt thêm vào allowlist (một nghĩa), hoặc tách symbolic key (đa nghĩa).");
    failed = true;
  } else {
    console.log(`✓ duplicates: 0 chuỗi trùng-file ngoài allowlist (${byLiteral.size} literal VI tổng)`);
  }
}

if (cmd === "specifiers") {
  const cat = loadCatalog();
  for (const [key, entry] of Object.entries(cat.strings ?? {})) {
    const en = entry?.localizations?.en;
    const units = [];
    if (en?.stringUnit?.value != null) units.push(en.stringUnit.value);
    for (const v of Object.values(en?.variations?.plural ?? {})) {
      if (v?.stringUnit?.value != null) units.push(v.stringUnit.value);
    }
    const keySpec = specifiersOf(key).join(" ");
    for (const val of units) {
      const enSpec = specifiersOf(val).join(" ");
      // Plural variant được phép NUỐT bớt specifier? Không — giữ luật cứng: khớp y hệt.
      if (enSpec !== keySpec) {
        console.error(`✗ specifier lệch: key "${key}" [${keySpec}] vs en "${val}" [${enSpec}]`);
        failed = true;
      }
    }
  }
  if (!failed) console.log(`✓ specifiers: mọi bản EN khớp key nguồn (${Object.keys(loadCatalog().strings ?? {}).length} entry)`);
}

if (cmd === "coverage") {
  const maxArg = process.argv.indexOf("--max");
  const max = maxArg > -1 ? Number(process.argv[maxArg + 1]) : Infinity;
  const cat = loadCatalog();
  const keys = new Set(Object.keys(cat.strings ?? {}));
  // Chuẩn hoá interpolation về %@ / %lld như SwiftUI hạ key (xấp xỉ đủ dùng cho đếm tiến độ)
  const norm = (s) => s.replace(/\\\((?:[^()]|\([^()]*\))*\)/g, "%@");
  let count = 0;
  const sample = [];
  for (const f of swiftFiles(APP_DIR)) {
    for (const lit of literalsIn(readFileSync(f, "utf8"))) {
      if (!keys.has(lit) && !keys.has(norm(lit))) {
        count++;
        if (sample.length < 10) sample.push(`${f.slice(ROOT.length)}: "${lit}"`);
      }
    }
  }
  console.log(`coverage: ${count} literal VI chưa có trong catalog (ngưỡng --max=${max})`);
  if (count > max) {
    console.error("✗ vượt ngưỡng. 10 mẫu đầu:");
    for (const s of sample) console.error("  " + s);
    failed = true;
  }
}

if (!["duplicates", "specifiers", "coverage"].includes(cmd)) {
  console.error("usage: native-i18n-gates.mjs <duplicates|specifiers|coverage> [--max N]");
  process.exit(2);
}
process.exit(failed ? 1 : 0);
