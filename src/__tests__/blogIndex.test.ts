import { describe, it, expect } from 'vitest';
import { parseFrontmatter, listBlogs, listTags, searchBlogs } from '../fs/blogIndex';
import type { DirNode } from '../types';

const file = (content: string) => ({ type: 'file' as const, content });

function makeFs(): DirNode {
  return {
    type: 'dir',
    children: {
      home: {
        type: 'dir',
        children: {
          user: {
            type: 'dir',
            children: {
              blog: {
                type: 'dir',
                children: {
                  'a.md': file('---\ntitle: Alpha\ntags: Foo, Bar\n---\nhello world'),
                  'b.md': file('---\ntitle: Beta\ntags: bar\n---\nsecond post'),
                  'note.txt': file('not a blog'),
                  sub: { type: 'dir', children: { 'c.md': file('no frontmatter, just content') } },
                },
              },
            },
          },
        },
      },
    },
  };
}

describe('parseFrontmatter', () => {
  it('extracts title and lowercased, trimmed tags', () => {
    const r = parseFrontmatter('---\ntitle: Alpha\ntags: Foo, Bar\n---\nbody');
    expect(r.title).toBe('Alpha');
    expect(r.tags).toEqual(['foo', 'bar']);
  });

  it('returns empty when no frontmatter', () => {
    const r = parseFrontmatter('just content');
    expect(r.title).toBeUndefined();
    expect(r.tags).toEqual([]);
  });
});

describe('listBlogs', () => {
  it('lists .md under /home/user/blog recursively, skipping other types, sorted by path', () => {
    const blogs = listBlogs(makeFs());
    expect(blogs.map((b) => b.path)).toEqual([
      '/home/user/blog/a.md',
      '/home/user/blog/b.md',
      '/home/user/blog/sub/c.md',
    ]);
  });

  it('falls back to filename when title is missing', () => {
    const blogs = listBlogs(makeFs());
    expect(blogs.find((b) => b.path.endsWith('c.md'))!.title).toBe('c');
  });

  it('returns empty when blog dir is missing', () => {
    expect(listBlogs({ type: 'dir', children: {} })).toEqual([]);
  });
});

describe('listTags', () => {
  it('dedupes and sorts tags', () => {
    expect(listTags(listBlogs(makeFs()))).toEqual(['bar', 'foo']);
  });
});

describe('searchBlogs', () => {
  const blogs = listBlogs(makeFs());

  it('matches title case-insensitively', () => {
    expect(searchBlogs(blogs, 'alpha').map((b) => b.title)).toEqual(['Alpha']);
  });

  it('ignores content (title only)', () => {
    expect(searchBlogs(blogs, 'second').map((b) => b.title)).toEqual([]);
  });

  it('matches title substring case-insensitively', () => {
    expect(searchBlogs(blogs, 'ALPH').map((b) => b.title)).toEqual(['Alpha']);
  });

  it('returns empty on no match', () => {
    expect(searchBlogs(blogs, 'zzzz')).toEqual([]);
  });
});
