type SearchableStudent = {
  nombre: string | null;
  cedula?: string | null;
  telefono?: string | null;
};

function normalize(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function createStudentMatcher(query: string) {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return () => true;

  return ({ nombre, cedula, telefono }: SearchableStudent) => {
    const fields = [normalize(nombre), normalize(cedula), normalize(telefono)];
    const identifiers = [cedula, telefono].map(value => (value ?? '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase());
    if (terms.every(term => /^\d+$/.test(term))) {
      const digits = terms.join('');
      return [...fields, ...identifiers].some(field => field.includes(digits));
    }
    return terms.every(term => fields.some(field => field.includes(term)) ||
      (/^\d+$/.test(term) && identifiers.some(value => value.includes(term))));
  };
}
