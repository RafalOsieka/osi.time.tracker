import { describe, expect, it } from 'vitest';
import {
  findMentionAtCaret,
  normalizeMentionText,
  rankMentionProjects,
  removeMention,
  resolveTypedMention,
} from '../../app/utils/title-mention';

function project(name: string, recentTrackedSeconds = 0) {
  return { name, recentTrackedSeconds };
}

describe('normalizeMentionText', () => {
  it('ignores case, diacritics (including ł) and separators', () => {
    expect(normalizeMentionText('Żółć Sp.')).toBe('zolcsp.');
    expect(normalizeMentionText('Łódź')).toBe('lodz');
    const forms = ['Project Example', 'project-example', 'project_example', 'projectexample'];
    expect(new Set(forms.map(normalizeMentionText)).size).toBe(1);
  });
});

describe('findMentionAtCaret', () => {
  it('recognises @ at the start and after whitespace, up to the caret', () => {
    expect(findMentionAtCaret('@hel', 4)).toEqual({ start: 0, end: 4, query: 'hel' });
    expect(findMentionAtCaret('fix login @hel', 14)).toEqual({ start: 10, end: 14, query: 'hel' });
    expect(findMentionAtCaret('@project ex', 11)?.query).toBe('project ex');
    expect(findMentionAtCaret('@hel fix', 4)?.query).toBe('hel');
  });

  it('ignores @ inside a word', () => {
    expect(findMentionAtCaret('reply to jan@firma.pl', 21)).toBeNull();
    expect(findMentionAtCaret('no mention', 10)).toBeNull();
  });
});

describe('rankMentionProjects', () => {
  it('matches diacritics and separators', () => {
    expect(rankMentionProjects([project('Żółć Sp. z o.o.')], 'zolc')).toHaveLength(1);
    expect(rankMentionProjects([project('Project Example')], 'project-example')).toHaveLength(1);
  });

  it('orders by tier, then recent usage, then name', () => {
    const ranked = rankMentionProjects(
      [
        project('Shell Migration', 9000),
        project('Helios', 0),
        project('Alpha Helios', 100),
        project('Beta Helios', 100),
        project('Unrelated', 5),
      ],
      'hel',
    );
    expect(ranked.map((p) => p.name)).toEqual([
      'Helios',
      'Alpha Helios',
      'Beta Helios',
      'Shell Migration',
    ]);
  });

  it('ranks a bare @ by recent use and caps at five', () => {
    const many = Array.from({ length: 12 }, (_, i) => project(`P${i}`, i));
    const ranked = rankMentionProjects(many, '');
    expect(ranked).toHaveLength(5);
    expect(ranked[0]?.name).toBe('P11');
  });
});

describe('removeMention', () => {
  it('collapses whitespace at the seam only', () => {
    expect(removeMention('fix  login @hel', 11, 15)).toBe('fix  login');
    expect(removeMention('@hel fix login', 0, 4)).toBe('fix login');
    expect(removeMention('fix @hel login', 4, 8)).toBe('fix login');
  });
});

describe('resolveTypedMention', () => {
  const projects = [project('Helios'), project('Helios Mobile'), project('Project Example')];

  it('resolves a full name at the end or start', () => {
    expect(resolveTypedMention('fix login @helios', projects)).toMatchObject({
      title: 'fix login',
      project: { name: 'Helios' },
    });
    expect(resolveTypedMention('@project-example fix login', projects)).toMatchObject({
      title: 'fix login',
      project: { name: 'Project Example' },
    });
  });

  it('prefers the longest word-prefix', () => {
    expect(resolveTypedMention('@helios mobile fix', projects)).toMatchObject({
      title: 'fix',
      project: { name: 'Helios Mobile' },
    });
    expect(resolveTypedMention('@project example fix', projects)?.title).toBe('fix');
  });

  it('keeps partial names literal', () => {
    expect(resolveTypedMention('fix login @hel', projects)).toBeNull();
  });

  it('keeps ambiguous names literal', () => {
    expect(resolveTypedMention('fix @helios', [project('Helios'), project('helios')])).toBeNull();
  });

  it('only considers the last mention token', () => {
    expect(resolveTypedMention('@helios fix @nope', projects)).toBeNull();
  });
});
