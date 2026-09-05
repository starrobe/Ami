// src/components/Palette.tsx
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { BlogInfo } from '../fs/blogIndex';
import type { SearchStore } from '../types';
import { listTags, searchBlogs } from '../fs/blogIndex';
import './Palette.css';

type Mode = 'blogs' | 'tags';

type Item =
  | { kind: 'blog'; blog: BlogInfo }
  | { kind: 'tag'; tag: string };

const MODES: { id: Mode; label: string }[] = [
  { id: 'blogs', label: '博客' },
  { id: 'tags', label: 'tag' },
];

interface PaletteProps {
  blogs: BlogInfo[];
  onOpen: (path: string) => void;
  onClose: () => void;
  search: SearchStore;
}

export default function Palette({ blogs, onOpen, onClose, search }: PaletteProps) {
  const [mode, setMode] = useState<Mode>('blogs');
  const [selected, setSelected] = useState(0);
  const [tag, setTag] = useState<string | null>(null);

  // The search query lives in the shared store (rendered in the status bar),
  // not in local state.
  const query = useSyncExternalStore(search.subscribe, search.getQuery);

  const tags = useMemo(() => listTags(blogs), [blogs]);

  const items = useMemo<Item[]>(() => {
    // Blog mode lists all blogs, filtered live by the status-bar search.
    if (mode === 'blogs') return searchBlogs(blogs, query).map((blog) => ({ kind: 'blog', blog }));
    // Tags mode: list tags, then drill into a tag's blogs.
    if (tag === null) return tags.map((t) => ({ kind: 'tag', tag: t }));
    return blogs.filter((b) => b.tags.includes(tag)).map((blog) => ({ kind: 'blog', blog }));
  }, [mode, blogs, query, tag, tags]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setSelected(0);
    setTag(null);
    search.setActive(false);
  };

  const activate = (item: Item) => {
    if (item.kind === 'blog') onOpen(item.blog.path);
    else {
      setTag(item.tag);
      setSelected(0);
    }
  };

  // Latest-handler-in-ref so the window listener never goes stale.
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (e.isComposing || e.keyCode === 229) return;
    const isInput = (e.target as HTMLElement)?.tagName === 'INPUT';
    // While the search input is focused, don't hijack the 1/2 mode keys
    // so the digits reach the input.
    if (isInput && (e.key === '1' || e.key === '2')) return;
    const clamped = Math.max(0, Math.min(items.length - 1, selected));

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setSelected((s) => Math.max(0, s - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelected((s) => Math.max(0, Math.min(items.length - 1, s + 1)));
        break;
      case 'Enter':
        e.preventDefault();
        if (items[clamped]) activate(items[clamped]);
        break;
      case 'Escape':
        e.preventDefault();
        if (mode === 'blogs' && search.getActive()) {
          // Clear the status-bar search and return to the plain list.
          search.setActive(false);
          search.setQuery('');
        } else if (mode === 'tags' && tag !== null) {
          setTag(null);
          setSelected(0);
        } else {
          onClose();
        }
        break;
      case 'Backspace':
        // vim-like: Backspace on an empty search cancels it.
        if (isInput && search.getActive() && search.getQuery() === '') {
          e.preventDefault();
          search.setActive(false);
          search.setQuery('');
        }
        break;
      case 'Tab':
        e.preventDefault();
        switchMode(MODES[(MODES.findIndex((x) => x.id === mode) + 1) % MODES.length].id);
        break;
      case '/':
        // Press "/" to open the search input in the status bar.
        if (mode === 'blogs' && !isInput) {
          e.preventDefault();
          search.setActive(true);
        }
        break;
      case '1':
        e.preventDefault();
        switchMode('blogs');
        break;
      case '2':
        e.preventDefault();
        switchMode('tags');
        break;
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);

  const safeSelected = Math.min(selected, Math.max(items.length - 1, 0));

  return (
    <div className="palette">
      <div className="palette-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={mode === m.id ? 'palette-tab palette-tab-active' : 'palette-tab'}
            onClick={() => switchMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="palette-list">
        {items.length === 0 ? (
          <div className="palette-empty">无结果</div>
        ) : (
          items.map((item, i) => (
            <div
              key={item.kind === 'blog' ? item.blog.path : item.tag}
              className={i === safeSelected ? 'palette-item palette-item-selected' : 'palette-item'}
              onMouseEnter={() => setSelected(i)}
              onClick={() => activate(item)}
            >
              {item.kind === 'blog' ? (
                <>
                  <span className="palette-item-title">{item.blog.title}</span>
                  <span className="palette-item-path">{item.blog.path}</span>
                </>
              ) : (
                <span className="palette-item-title">#{item.tag}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
