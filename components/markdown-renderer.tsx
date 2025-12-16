'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  role: 'user' | 'model';
}

export function MarkdownRenderer({ content, role }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none break-words",
        role === 'user' ? "prose-invert" : "text-gray-800 dark:prose-invert"
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code({ inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = inline || !match;
          
          if (isInline) {
            return (
              <code 
                className={cn(
                  "px-1 py-0.5 rounded font-mono text-sm",
                  role === 'user' 
                    ? "bg-blue-700 text-white" 
                    : "bg-gray-100 text-red-500"
                )} 
                {...props}
              >
                {children}
              </code>
            );
          }

          const language = match ? match[1] : '';
          const codeContent = String(children).replace(/\n$/, '');

          return (
             <CodeBlock language={language} value={codeContent} />
          );
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        a: ({ node, ...props }) => (
          <a 
            {...props} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={cn(
              "underline underline-offset-4",
              role === 'user' ? "text-white decoration-white/50 hover:decoration-white" : "text-blue-600 decoration-blue-300 hover:decoration-blue-600"
            )}
          />
        ),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-4 my-2" />,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-4 my-2" />,
      }}
    >
      {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden my-3 border border-gray-200 bg-[#1e1e1e]">
      <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d2d] text-gray-300 text-xs select-none">
        <span className="font-mono font-bold lowercase">{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none bg-white/10 hover:bg-white/20 px-2 py-1 rounded"
          aria-label="Copy code"
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.875rem', padding: '1rem' }}
          PreTag="div"
          showLineNumbers={true}
          wrapLines={true}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
