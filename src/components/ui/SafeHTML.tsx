"use client";

import DOMPurify from "isomorphic-dompurify";

interface SafeHTMLProps {
  html: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Safely render HTML content with XSS protection via DOMPurify
 */
export function SafeHTML({ html, className, as: Tag = "div" }: SafeHTMLProps) {
  const sanitizedHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre",
      "table", "thead", "tbody", "tr", "th", "td", "img", "span", "div"
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "class", "style"],
    ALLOW_DATA_ATTR: false,
  });

  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
}

export default SafeHTML;
