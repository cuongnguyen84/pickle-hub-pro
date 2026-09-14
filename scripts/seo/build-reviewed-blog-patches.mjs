// Regenerate the reviewed VI article payloads from the same bilingual sources.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const targets = [
  ['vietnam-pickleball-tournament-calendar-2026', 'lich-giai-pickleball-viet-nam-2026', '2026-08-28T00:16:06.044801+00:00'],
  ['best-pickleball-tournament-software-2026', 'phan-mem-to-chuc-giai-pickleball-2026', '2026-08-19T02:12:32.20696+00:00'],
];
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const updates = targets.map(([slug, viSlug, expectedUpdatedAt]) => {
  const source = fs.readFileSync(`src/content/blog/posts/${slug}.ts`, 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports });
  const post = module.exports.default;
  const content = post.content.vi;
  const parts = [`<h1>${esc(content.title)}</h1><p>Cập nhật ${esc(post.updatedDate)} · ${esc(post.author)}</p>`];
  for (const section of content.sections) {
    parts.push(`<h2>${esc(section.heading)}</h2><p>${esc(section.content)}</p>`);
    for (const [key, tag] of [['listItems', 'ul'], ['orderedList', 'ol']]) if (section[key]?.length) parts.push(`<${tag}>${section[key].map((item) => `<li>${esc(item)}</li>`).join('')}</${tag}>`);
    if (section.table) {
      const table = section.table;
      parts.push(`<table>${table.caption ? `<caption>${esc(table.caption)}</caption>` : ''}<thead><tr>${table.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    }
    if (section.internalLinks?.length) parts.push(`<ul>${section.internalLinks.map((l) => `<li><a href="${esc(l.path)}">${esc(l.text)}</a></li>`).join('')}</ul>`);
  }
  if (content.faqItems?.length) parts.push(`<h2>Câu hỏi thường gặp</h2>${content.faqItems.map((f) => `<h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p>`).join('')}`);
  return { slug: viSlug, alternate_en_slug: slug, expected_updated_at: expectedUpdatedAt, patch: {
    title: content.title, meta_title: content.metaTitle, meta_description: content.metaDescription,
    content_html: parts.join('\n'), faq_items: content.faqItems ?? [], author_name: post.author,
  } };
});
fs.writeFileSync('docs/seo/2026-09-14/vi-blog-patches.json', JSON.stringify(updates, null, 2) + '\n');
console.log(`Prepared ${updates.length} reviewed VI article updates; no remote writes.`);
