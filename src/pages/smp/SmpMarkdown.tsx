import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Shared markdown renderer for SMP content, mirroring the styling used in ModDetail.
const SmpMarkdown: React.FC<{ children: string }> = ({ children }) => (
  <div className="prose prose-invert max-w-none">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="font-headline-md text-[28px] text-white mt-8 mb-3">{children}</h1>,
        h2: ({ children }) => <h2 className="font-headline-md text-[22px] text-white mt-6 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="font-headline-md text-[18px] text-white mt-5 mb-2">{children}</h3>,
        p: ({ children }) => <p className="font-body-sm text-on-surface-variant leading-relaxed mb-4">{children}</p>,
        strong: ({ children }) => <strong className="text-white font-bold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-on-surface-variant/40 pl-4 my-4 italic text-on-surface-variant/80">{children}</blockquote>
        ),
        ul: ({ children }) => <ul className="list-disc ml-6 mb-4 space-y-1 text-on-surface-variant">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 space-y-1 text-on-surface-variant">{children}</ol>,
        li: ({ children }) => <li className="font-body-sm text-on-surface-variant">{children}</li>,
        hr: () => <hr className="border-on-surface-variant/20 my-6" />,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-tertiary hover:underline">{children}</a>,
      }}
    >
      {children}
    </ReactMarkdown>
  </div>
);

export default SmpMarkdown;
