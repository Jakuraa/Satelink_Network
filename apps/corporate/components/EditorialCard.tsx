import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export interface EditorialCardProps {
  eyebrow?: string;
  title: string;
  description: string;
  metadata?: string;
  href?: string;
  linkText?: string;
  external?: boolean;
  imageSrc: string;
  imageAlt: string;
  imageCaption?: string;
  reversed?: boolean;
  className?: string;
}

export function EditorialCard({
  eyebrow,
  title,
  description,
  metadata,
  href,
  linkText = 'Read more',
  external = false,
  imageSrc,
  imageAlt,
  imageCaption,
  reversed = false,
  className = '',
}: EditorialCardProps) {
  const content = (
    <article
      className={`group rounded-2xl border border-stone-1 bg-ivory p-6 sm:p-8 lg:p-10 transition-all duration-300 hover:border-stone-3 hover:shadow-md ${className}`}
    >
      <div
        className={`grid gap-8 lg:grid-cols-12 lg:items-center ${
          reversed ? 'lg:grid-flow-dense' : ''
        }`}
      >
        {/* Text Column */}
        <div className={`space-y-4 lg:col-span-6 ${reversed ? 'lg:col-start-7' : ''}`}>
          {eyebrow && (
            <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
              {eyebrow}
            </span>
          )}

          <h3 className="font-serif text-2xl sm:text-3xl text-ink leading-snug group-hover:text-green transition-colors">
            {title}
          </h3>

          <p className="text-base leading-relaxed text-stone-4 font-sans">
            {description}
          </p>

          {metadata && (
            <p className="font-mono text-xs text-stone-3 pt-1">
              {metadata}
            </p>
          )}

          {href && (
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green group-hover:underline">
                <span>{linkText}</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </div>
          )}
        </div>

        {/* Visual Column */}
        <div
          className={`relative aspect-[16/10] sm:aspect-[16/10] lg:aspect-[4/3] w-full overflow-hidden rounded-xl border border-stone-2 bg-stone-1/20 lg:col-span-6 ${
            reversed ? 'lg:col-start-1' : ''
          }`}
        >
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          {imageCaption && (
            <div className="absolute bottom-3 left-3 right-3 rounded bg-ink/80 px-3 py-2 text-ivory backdrop-blur-sm">
              <p className="font-mono text-[11px] leading-tight text-stone-2">
                {imageCaption}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );

  if (!href) return content;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
