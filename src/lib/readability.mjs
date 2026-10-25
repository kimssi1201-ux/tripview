export function normalizeReadableText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function sentenceUnits(value = "") {
  const text = normalizeReadableText(value);
  if (!text) return [];
  const protectedText = text.replace(/(\d)\.(\d)/g, "$1__DECIMAL_POINT__$2");
  const sentences = protectedText
    .match(/[^.!?。]+[.!?。]?/g)
    ?.map((sentence) => normalizeReadableText(sentence.replaceAll("__DECIMAL_POINT__", ".")))
    .filter(Boolean) || [text];
  const units = [];
  for (const sentence of sentences) {
    if (sentence.length <= 125) {
      units.push(sentence);
      continue;
    }
    const parts = sentence
      .split(/(?<=,)\s+|(?<=;)\s+|\s+·\s+/)
      .map(normalizeReadableText)
      .filter(Boolean);
    units.push(...(parts.length > 1 ? parts : [sentence]));
  }
  return units;
}

export function splitReadableParagraphs(value = "") {
  const units = sentenceUnits(value);
  const paragraphs = [];
  let current = "";
  for (const unit of units) {
    if (current && `${current} ${unit}`.length > 120) {
      paragraphs.push(current);
      current = unit;
    } else {
      current = [current, unit].filter(Boolean).join(" ");
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

export function readableSections(sections = []) {
  return sections.map((section) => ({
    ...section,
    paragraphs: (section.paragraphs || []).flatMap(splitReadableParagraphs).filter(Boolean),
  }));
}

/**
 * The article layout already displays the excerpt above the body.
 * Remove its exact duplicate when a generated first section repeats it.
 * Never remove partial matches or unique copy.
 */
export function removeDuplicateLead(sections = [], excerpt = "") {
  const lead = normalizeReadableText(excerpt);
  if (!lead || !sections.length) return sections;
  return sections.map((section, index) => {
    if (index !== 0) return section;
    const paragraphs = section.paragraphs || [];
    let combined = "";
    let count = 0;
    for (const paragraph of paragraphs) {
      combined = normalizeReadableText([combined, paragraph].filter(Boolean).join(" "));
      if (!lead.startsWith(combined)) break;
      count += 1;
      if (combined === lead) break;
    }
    const remaining = combined === lead ? paragraphs.slice(count) : paragraphs;
    return { ...section, paragraphs: remaining };
  }).filter((section) => section.paragraphs?.length);
}
