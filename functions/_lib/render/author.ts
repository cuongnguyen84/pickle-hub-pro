import { AUTHOR_PATH, authorProfile, authorIdentity } from '../../../src/content/authors';
import { blogMetadata } from '../../../src/content/blog/metadata';
import { buildHtml, htmlResponse } from '../html';
import { bilingualHreflang, escapeHtml, type Lang } from '../utils';

export function renderAuthor(siteUrl: string, lang: Lang): Response {
  const url = `${siteUrl}${lang === 'vi' ? '/vi' : ''}${AUTHOR_PATH}`;
  const articles = blogMetadata.filter((p) => p.author === authorProfile.name);
  return htmlResponse(buildHtml({
    title: `${authorProfile.name} | ThePickleHub`, description: authorProfile.role[lang],
    url, siteUrl, lang, omitAutoHeader: true,
    extraMeta: bilingualHreflang(`${siteUrl}${AUTHOR_PATH}`, `${siteUrl}/vi${AUTHOR_PATH}`),
    jsonLd: { '@context': 'https://schema.org', '@type': 'ProfilePage', url, mainEntity: authorIdentity(authorProfile.name, siteUrl) },
    bodyContent: `<article><h1>${authorProfile.name}</h1><p>${escapeHtml(authorProfile.role[lang])}</p><p>${escapeHtml(authorProfile.bio[lang])}</p><h2>${lang === 'vi' ? 'Bài viết có tên tác giả' : 'Articles by Cuong Nguyen'}</h2><ul>${articles.map((p) => `<li><a href="${siteUrl}/blog/${p.slug}">${escapeHtml(p.titleEn)}</a></li>`).join('')}</ul><p><a href="${siteUrl}${lang === 'vi' ? '/vi' : ''}/contact">${lang === 'vi' ? 'Gửi góp ý hoặc đính chính' : 'Send feedback or a correction'}</a></p></article>`,
  }));
}
