import sanitizeHtml from "sanitize-html";

export const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

export function decodeTransfer(raw: Buffer, encoding: string | undefined) {
  const kind = (encoding ?? "").toLowerCase();
  if (kind === "base64") {
    const text = raw.toString("ascii").replace(/[^A-Za-z0-9+/=]/g, "");
    return Buffer.from(text.slice(0, text.length - (text.length % 4)), "base64");
  }
  if (kind === "quoted-printable") {
    const text = raw.toString("latin1").replace(/=\r?\n/g, "");
    const bytes: number[] = [];
    for (let index = 0; index < text.length; index += 1) {
      const hex = text.slice(index + 1, index + 3);
      if (text[index] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        index += 2;
      } else bytes.push(text.charCodeAt(index) & 0xff);
    }
    return Buffer.from(bytes);
  }
  return raw;
}

export function decodeText(bytes: Buffer, charset: string | undefined) {
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export function previewText(text: string, html: boolean) {
  let value = text;
  if (html) {
    value = value
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }
  return value
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function cleanHtml(html: string) {
  let remote = false;
  const clean = sanitizeHtml(html, {
    allowedTags: [
      "a", "abbr", "address", "b", "big", "blockquote", "br", "caption", "center", "cite", "code", "col", "colgroup", "dd", "del", "div", "dl", "dt", "em", "font", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
      "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre", "q", "s", "small", "span", "strike", "strong", "style", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "tt", "u", "ul",
    ],
    allowVulnerableTags: true,
    allowedAttributes: {
      "*": ["style", "align", "valign", "width", "height", "bgcolor", "color", "border", "dir", "lang", "class", "title"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      font: ["face", "size", "color"],
      table: ["cellpadding", "cellspacing", "border", "width", "bgcolor", "background"],
      td: ["colspan", "rowspan", "nowrap", "background"],
      th: ["colspan", "rowspan", "nowrap", "background"],
      col: ["span", "width"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowedSchemesAppliedToAttributes: ["href", "src", "background"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
      img: (tagName, attribs) => {
        if (/^https?:/i.test(attribs.src ?? "")) remote = true;
        return { tagName, attribs };
      },
    },
  });
  if (/url\(\s*['"]?\s*https?:/i.test(clean) || /background=["']?https?:/i.test(clean)) remote = true;
  return { html: clean, remote };
}

export function safeName(name: string) {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+/, "").trim().slice(0, 150);
  return cleaned || "ek";
}

export function addresses(value: string | undefined) {
  return (value ?? "")
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.match(/<([^>]+)>/)?.[1]?.trim() ?? item);
}
