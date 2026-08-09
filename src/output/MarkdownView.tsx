import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './MarkdownView.css';

interface Props {
  content: string;
}

export default function MarkdownView({ content }: Props) {
  return (
    <div className="markdown-view">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
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
          img: ({ src, alt }: { src?: string; alt?: string }) => (
            <img className="md-img" src={src} alt={alt} style={{ maxWidth: '100%' }} />
          ),
          table: ({ children }) => <table className="md-table">{children}</table>,
          thead: ({ children }) => <thead className="md-thead">{children}</thead>,
          tbody: ({ children }) => <tbody className="md-tbody">{children}</tbody>,
          tr: ({ children }) => <tr className="md-tr">{children}</tr>,
          th: ({ children }) => <th className="md-th">{children}</th>,
          td: ({ children }) => <td className="md-td">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
