export type RedactionResult = {
  text: string;
  counts: { names: number; ids: number; phones: number };
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactPhi(input: string, knownNames: string[] = []): RedactionResult {
  const counts = { names: 0, ids: 0, phones: 0 };
  let text = input;

  for (const name of [...knownNames].sort((a, b) => b.length - a.length)) {
    if (!name.trim()) continue;
    text = text.replace(new RegExp(`\\b${escapeRegExp(name.trim())}\\b`, 'gi'), () => {
      counts.names += 1;
      return '[NAME]';
    });
  }

  text = text.replace(/\b[STFGM]\d{7}[A-Z]\b/gi, () => {
    counts.ids += 1;
    return '[ID]';
  });

  text = text.replace(/(?:\+65[\s-]?)?[689]\d{3}[\s-]?\d{4}\b/g, () => {
    counts.phones += 1;
    return '[PHONE]';
  });

  return { text, counts };
}
