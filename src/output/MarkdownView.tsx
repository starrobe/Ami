import React from 'react';
import ReactMarkdown from 'react-markdown';
import './MarkdownView.css';

interface Props {
  content: string;
}

export default function MarkdownView({ content }: Props) {
  return (
    <div className="markdown-view">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
          p: ({ children }) => <p className="md-p">{children}</p>,
          ul: ({ children }) => <ul className="md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="md-ol">{children}</ol>,
          li: ({ children }) => <li className="md-li">{children}</li>,
          code: ({ className, children }) => {
            const isInline = !className;
            return isInline ? (
              <code className="md-code-inline">{children}</code>
            ) : (
              <pre className="md-code-block"><code>{children}</code></pre>
            );
          },
          a: ({ href, children }) => (
            <a className="md-link" href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="md-strong">{children}</strong>,
          em: ({ children }) => <em className="md-em">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="md-blockquote">{children}</blockquote>
          ),
          hr: () => <hr className="md-hr" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
