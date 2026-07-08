// Reuse the site OG for X/Twitter. Having this file makes Next emit twitter:image and
// twitter:card=summary_large_image, which X needs to render a large preview (Telegram is happy
// with og:image alone, X is not).
export { default, alt, size, contentType } from "./opengraph-image";
