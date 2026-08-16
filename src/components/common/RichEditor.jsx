import { useRef, useEffect } from 'react';

/**
 * Minimal rich-text editor using contentEditable (PRD JN-002 .. JN-005).
 * Supports: bold, italic, H1-H3, unordered list, ordered list.
 * Auto-saves via parent-provided onChange(html) — debounced upstream.
 *
 * Important caveats:
 *   - We mark this as an uncontrolled component: HTML is set from props only
 *     when the dateKey changes, not on every render. This avoids caret jumps
 *     during typing and auto-save round-trips.
 */
const COMMANDS = {
  bold:    () => document.execCommand('bold'),
  italic:  () => document.execCommand('italic'),
  h1:      () => document.execCommand('formatBlock', false, 'H1'),
  h2:      () => document.execCommand('formatBlock', false, 'H2'),
  h3:      () => document.execCommand('formatBlock', false, 'H3'),
  ul:      () => document.execCommand('insertUnorderedList'),
  ol:      () => document.execCommand('insertOrderedList'),
};

export default function RichEditor({ dateKey, initialHtml, onChange }) {
  const editorRef = useRef(null);

  // Sync HTML when dateKey changes (not on every parent rerender).
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml || '';
    }
  }, [dateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function emit() {
    const html = editorRef.current?.innerHTML || '';
    onChange?.(html);
  }

  const toolbarBtns = [
    { id: 'bold',   label: 'B',     title: 'Bold (Ctrl+B)',         style: { fontWeight: 700 } },
    { id: 'italic', label: 'I',     title: 'Italic (Ctrl+I)',        style: { fontStyle: 'italic' } },
    { id: 'h1',     label: 'H1',    title: 'Heading 1' },
    { id: 'h2',     label: 'H2',    title: 'Heading 2' },
    { id: 'h3',     label: 'H3',    title: 'Heading 3' },
    { id: 'ul',     label: '•',     title: 'Bulleted list' },
    { id: 'ol',     label: '1.',    title: 'Numbered list' },
  ];

  return (
    <div className="richeditor">
      <div className="richeditor__toolbar" role="toolbar" aria-label="Formatting">
        {toolbarBtns.map((b) => (
          <button
            key={b.id}
            type="button"
            className="richeditor__btn"
            title={b.title}
            style={b.style}
            onMouseDown={(e) => {
              e.preventDefault();
              COMMANDS[b.id]();
              editorRef.current?.focus();
              emit();
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div
        ref={editorRef}
        className="richeditor__surface"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Journal entry"
        spellCheck
        onInput={emit}
        onBlur={emit}
        data-placeholder="Start writing today's entry..."
      />
    </div>
  );
}
