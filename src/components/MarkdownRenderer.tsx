import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Parses inline markdown tokens: ***bold+italic***, **bold**, *italic*, `code`, and [link](url)
 */
function renderInline(text: string): React.ReactNode[] {
  if (!text) return [];

  const tokenRegex =
    /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

  const parts = text.split(tokenRegex);
  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('***') && part.endsWith('***') && part.length > 6) {
      return (
        <strong key={idx} className="font-bold italic text-[#202124]">
          {part.slice(3, -3)}
        </strong>
      );
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#202124]">
          {renderInline(part.slice(2, -2))}
        </strong>
      );
    }

    if (
      ((part.startsWith('*') && part.endsWith('*')) ||
        (part.startsWith('_') && part.endsWith('_'))) &&
      part.length > 2
    ) {
      return (
        <em key={idx} className="italic text-[#174EA6]">
          {renderInline(part.slice(1, -1))}
        </em>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-[#E8F0FE] border border-[#D2E3FC] text-[#174EA6] font-mono text-[11px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1A73E8] hover:text-[#1557B0] underline underline-offset-2 font-medium"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?[\s:-]+\|[\s|:-]+\|?$/.test(trimmed) && trimmed.includes('-');
}

function parseTableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    // Fenced Code Block (```lang ... ```)
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push(
        <div
          key={`code-${i}`}
          className="my-2.5 rounded-xl overflow-hidden border border-[#DADCE0] bg-[#202124] text-[#E8EAED] shadow-2xs"
        >
          {lang && (
            <div className="px-3.5 py-1.5 bg-[#303134] border-b border-[#3C4043] text-[10px] font-mono uppercase tracking-wider text-[#8AB4F8]">
              {lang}
            </div>
          )}
          <pre className="p-3.5 overflow-x-auto text-[11px] font-mono leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Horizontal Rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push(<hr key={`hr-${i}`} className="border-[#E8EAED] my-3" />);
      i++;
      continue;
    }

    // Markdown Table
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = parseTableCells(line);
      i += 2; // skip header and separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        if (!isTableSeparator(lines[i])) {
          rows.push(parseTableCells(lines[i]));
        }
        i++;
      }

      blocks.push(
        <div
          key={`tbl-${i}`}
          className="overflow-x-auto my-2.5 rounded-xl border border-[#DADCE0] bg-white shadow-2xs"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#DADCE0] bg-[#F8FAFD] text-[11px] font-semibold text-[#1967D2] uppercase tracking-wider">
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="py-2.5 px-3">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[#F8FAFD] transition-colors">
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="py-2 px-3 text-[#3C4043]">
                      {renderInline(row[cIdx] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blockquote (> ...)
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className="border-l-4 border-[#4285F4] bg-[#E8F0FE]/70 px-4 py-2.5 rounded-r-xl text-[#202124] my-2 space-y-1"
        >
          {quoteLines.map((ql, qIdx) => (
            <div key={qIdx} className="leading-relaxed">
              {renderInline(ql)}
            </div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Headings (#, ##, ###, ####)
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const headingClass =
        level === 1
          ? 'text-base font-bold text-[#202124] mt-3 mb-1.5'
          : level === 2
          ? 'text-sm font-bold text-[#202124] mt-3 mb-1.5 flex items-center gap-1.5'
          : 'text-xs sm:text-[13px] font-bold text-[#1A73E8] uppercase tracking-wide mt-3 mb-1';
      blocks.push(
        <div key={`hd-${i}`} className={headingClass}>
          {renderInline(headingText)}
        </div>
      );
      i++;
      continue;
    }

    // Unordered List (-, *, •)
    if (/^([-*•])\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^([-*•])\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*•])\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="space-y-1.5 my-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed text-[#3C4043]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4] mt-1.5 shrink-0" />
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered List (1. , 2. )
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="space-y-1.5 my-1.5 pl-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed text-[#3C4043]">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#E8F0FE] border border-[#D2E3FC] text-[#1967D2] text-[10px] font-bold shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Standard Paragraph
    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed text-[#3C4043] my-1">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className={`space-y-1.5 ${className}`}>{blocks}</div>;
};
