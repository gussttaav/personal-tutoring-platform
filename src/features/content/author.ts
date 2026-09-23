/*
 * CONTENT-AUTHOR-01 — the author's identity, as the reader surfaces render it.
 *
 * Its own module rather than a pair of exports on `AuthorBio.tsx` because that file
 * imports `author-bio.css`: a consumer that wants only the name and the portrait — the
 * blog byline, the signed `LessonCta` — would otherwise drag the card's stylesheet onto
 * a route that never mounts the card.
 *
 * NOT the whole identity. The bio prose lives in `landing.bio.*` (it is translated), the
 * schema.org Person is built by the SEO components from `NEXT_PUBLIC_BASE_URL`, and the
 * policy pages spell the name out in legal prose. This is just what a card, a byline or a
 * signature needs.
 */

/** Full display name, for the card. Not translated — a proper noun reads the same in
 *  both locales. */
export const AUTHOR_NAME = "Gustavo Torres Guerrero";

/** The short form the rest of the site already uses (page titles, the BlogPosting
 *  `author.name`). It is what a byline wants: the full three-part name set uppercase
 *  on the post dateline wraps that row to three lines on a phone, and says nothing
 *  more than this does. */
export const AUTHOR_SHORT_NAME = "Gustavo Torres";

/** Portrait, served from /public. */
export const AUTHOR_AVATAR = "/avatar.png";

export const AUTHOR_GITHUB_URL = "https://github.com/gussttaav";
export const AUTHOR_LINKEDIN_URL = "https://www.linkedin.com/in/gustavo-torres-guerrero";
