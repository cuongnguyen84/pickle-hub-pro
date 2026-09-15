export const AUTHOR_PATH = '/authors/cuong-nguyen';
export const authorProfile = {
  name: 'Cuong Nguyen',
  role: { en: 'Builder and contributor at ThePickleHub', vi: 'Người xây dựng và cộng tác nội dung ThePickleHub' },
  bio: {
    en: 'Cuong Nguyen builds ThePickleHub and contributes reporting about pickleball in Vietnam and Asia. His September 2026 World Cup diary documents his time in the stands at Tien Son Sports Palace, with photographs and observations from the event.',
    vi: 'Cuong Nguyen xây dựng ThePickleHub và đóng góp nội dung về pickleball Việt Nam, châu Á. Nhật ký World Cup tháng 9/2026 ghi lại thời gian tại khán đài Cung thể thao Tiên Sơn, kèm ảnh và quan sát tại sự kiện.',
  },
};

/** Use the actual byline; never attribute every team/guest article to one person. */
export function authorIdentity(name: string, siteUrl = 'https://www.thepicklehub.net') {
  if (name === authorProfile.name) return { '@type': 'Person', name, url: `${siteUrl}${AUTHOR_PATH}`, '@id': `${siteUrl}${AUTHOR_PATH}#person` };
  const organization = /team|pickle\s*hub/i.test(name) || !name;
  return organization
    ? { '@type': 'Organization', name: 'ThePickleHub', url: `${siteUrl}/about` }
    : { '@type': 'Person', name };
}
