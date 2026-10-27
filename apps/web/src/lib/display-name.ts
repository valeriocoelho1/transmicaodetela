import { displayName } from '@app/shared';

const STORAGE_KEY = 'display-name';

// Adjectives that read the same in masculine and feminine, so any pair agrees in Portuguese.
const animals = [
  'Capivara',
  'Tucano',
  'Onça',
  'Arara',
  'Jabuti',
  'Lontra',
  'Coruja',
  'Raposa',
  'Lhama',
  'Polvo',
  'Pinguim',
  'Tatu',
  'Quati',
  'Sabiá',
  'Panda',
  'Mico',
];
const traits = [
  'Veloz',
  'Feliz',
  'Gentil',
  'Ágil',
  'Audaz',
  'Valente',
  'Elegante',
  'Brilhante',
  'Radiante',
  'Sagaz',
  'Paciente',
  'Sutil',
  'Cordial',
  'Incrível',
  'Leal',
  'Tenaz',
];

function pick<T>(list: readonly T[]): T {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return list[value % list.length]!;
}

export function randomDisplayName(): string {
  return `${pick(animals)} ${pick(traits)}`;
}

export function parseDisplayName(value: string): string | null {
  const parsed = displayName.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function loadDisplayName(): string {
  try {
    const stored = parseDisplayName(localStorage.getItem(STORAGE_KEY) ?? '');
    if (stored) return stored;
    const generated = randomDisplayName();
    localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch {
    return randomDisplayName();
  }
}

export function saveDisplayName(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Storage may be unavailable; the name still applies to this visit.
  }
}
