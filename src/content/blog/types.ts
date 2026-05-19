export interface BlogSection {
  heading: string;
  content: string;
  listItems?: string[];
  orderedList?: string[];
  internalLinks?: { text: string; path: string }[];
  image?: { src: string; alt: string; caption?: string };
}

export interface BlogPostContent {
  title: string;
  metaTitle: string;
  metaDescription: string;
  sections: BlogSection[];
  faqItems?: { question: string; answer: string }[];
  howToSteps?: { name: string; text: string }[];
}

export interface BlogPost {
  slug: string;
  publishedDate: string;
  updatedDate: string;
  author: string;
  tags: string[];
  ctaPath: string;
  ctaLabel: { en: string; vi: string };
  heroImage?: { src: string; alt: string };
  content: {
    en: BlogPostContent;
    vi: BlogPostContent;
  };
}

/**
 * Lightweight metadata shape — used by list pages (Blog index, home section)
 * so we don't load full section content / FAQ data for every card on the list.
 */
export interface BlogPostMetadata {
  slug: string;
  publishedDate: string;
  updatedDate: string;
  author: string;
  tags: string[];
  ctaPath: string;
  ctaLabel: { en: string; vi: string };
  heroImage?: { src: string; alt: string };
  titleEn: string;
  titleVi: string;
  metaTitleEn: string;
  metaTitleVi: string;
  metaDescriptionEn: string;
  metaDescriptionVi: string;
}
