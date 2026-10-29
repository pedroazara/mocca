import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Markdown simples (negrito, itálico, listas, links) para descrições,
// comentários e anotações. HTML cru não é interpretado.
export function Markdown({ texto, className }: { texto: string; className?: string }) {
  return (
    <div
      className={cn(
        "text-[0.9375rem] leading-relaxed text-texto [&_a]:text-link [&_a]:underline [&_a]:underline-offset-[3px] [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-superficie-2 [&_code]:px-1 [&_code]:font-dado [&_code]:text-[0.875em] [&_h1]:font-titulo [&_h1]:font-semibold [&_h2]:font-titulo [&_h2]:font-semibold [&_h3]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-linha [&_blockquote]:pl-3 [&_blockquote]:text-texto-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {texto}
      </ReactMarkdown>
    </div>
  );
}
