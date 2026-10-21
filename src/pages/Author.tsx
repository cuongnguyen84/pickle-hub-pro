import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TheLineLayout } from '@/components/layout';
import { HreflangTags } from '@/components/seo';
import { useI18n } from '@/i18n';
import { AUTHOR_PATH, authorProfile, authorIdentity } from '@/content/authors';
import { blogMetadata } from '@/content/blog/metadata';

export default function Author() {
  const { setLanguageFromUrl } = useI18n();
  const { pathname } = useLocation();
  const lang = pathname.startsWith('/vi/') ? 'vi' : 'en';
  useEffect(() => { setLanguageFromUrl(lang); }, [lang, setLanguageFromUrl]);
  const posts = blogMetadata.filter((p) => p.author === authorProfile.name);
  return (
    <TheLineLayout title={`${authorProfile.name} | ThePickleHub`} description={authorProfile.role[lang]} active="stories">
      <script type="application/ld+json">{JSON.stringify({ '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: authorIdentity(authorProfile.name) })}</script>
      <HreflangTags enPath={AUTHOR_PATH} viPath={`/vi${AUTHOR_PATH}`} />
      <article className="tl-shell" style={{ maxWidth: 880, paddingTop: 32, paddingBottom: 64 }}>
        <h1>{authorProfile.name}</h1>
        <p>{authorProfile.role[lang]}</p>
        <p style={{ marginTop: 24, lineHeight: 1.7 }}>{authorProfile.bio[lang]}</p>
        <h2 style={{ marginTop: 32 }}>{lang === 'vi' ? 'Bài viết có tên tác giả' : 'Articles by Cuong Nguyen'}</h2>
        <ul style={{ lineHeight: 1.8 }}>{posts.map((p) => <li key={p.slug}><Link to={`/blog/${p.slug}`}>{p.titleEn}</Link></li>)}</ul>
        <p style={{ marginTop: 24 }}><Link to={lang === 'vi' ? '/vi/contact' : '/contact'}>{lang === 'vi' ? 'Gửi góp ý hoặc đính chính' : 'Send feedback or a correction'}</Link></p>
      </article>
    </TheLineLayout>
  );
}
