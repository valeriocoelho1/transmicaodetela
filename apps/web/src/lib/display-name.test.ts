// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  avatarColor,
  initialOf,
  loadDisplayName,
  parseDisplayName,
  randomDisplayName,
  saveDisplayName,
} from './display-name';

describe('display-name', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('generates a valid two-word name', () => {
    const name = randomDisplayName();
    expect(name.split(' ')).toHaveLength(2);
    expect(parseDisplayName(name)).toBe(name);
  });

  it('keeps the generated name across visits and replaces an invalid stored one', () => {
    const first = loadDisplayName();
    expect(loadDisplayName()).toBe(first);
    saveDisplayName('   ');
    expect(loadDisplayName()).not.toBe('   ');
    saveDisplayName('Ana');
    expect(loadDisplayName()).toBe('Ana');
  });

  it('takes the first character as an uppercase initial', () => {
    expect(initialOf('  ana')).toBe('A');
    expect(initialOf('élio')).toBe('É');
    expect(initialOf('🎮 gamer')).toBe('🎮');
  });

  it('gives the same name the same color', () => {
    expect(avatarColor('Ana')).toBe(avatarColor('Ana'));
  });
});
