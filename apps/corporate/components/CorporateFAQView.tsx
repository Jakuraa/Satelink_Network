'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Minus } from 'lucide-react';

export interface CorporateFAQItem {
  category: string;
  question: string;
  answer: string;
}

export function CorporateFAQView({ items }: { items: CorporateFAQItem[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [openQuestions, setOpenQuestions] = useState<Record<string, boolean>>(() => {
    return items.length > 0 ? { [items[0].question]: true } : {};
  });

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category)));
    return ['All', ...cats];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'All') return items;
    return items.filter((i) => i.category === selectedCategory);
  }, [items, selectedCategory]);

  const toggleQuestion = (q: string) => {
    setOpenQuestions((prev) => ({
      ...prev,
      [q]: !prev[q],
    }));
  };

  return (
    <div className="w-full space-y-8">
      {/* Category Tabs (Reference E) */}
      <div
        role="tablist"
        aria-label="FAQ Categories"
        className="flex flex-wrap items-center gap-2 border-b border-stone-2 pb-4"
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          const count = cat === 'All' ? items.length : items.filter((i) => i.category === cat).length;

          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedCategory(cat)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-ink text-ivory font-semibold shadow-sm'
                  : 'bg-stone-1 text-stone-4 hover:text-ink hover:bg-stone-2'
              }`}
            >
              <span>{cat}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  isSelected ? 'bg-white/20 text-ivory' : 'bg-stone-2 text-stone-4'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Accordion Questions List (Reference E & F Pattern) */}
      <div className="divide-y divide-stone-2">
        {filteredItems.map((item, idx) => {
          const isOpen = Boolean(openQuestions[item.question]);
          const panelId = `corp-faq-panel-${idx}`;
          const btnId = `corp-faq-btn-${idx}`;

          return (
            <div key={item.question} className="py-6 transition-colors">
              <h3>
                <button
                  type="button"
                  id={btnId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleQuestion(item.question)}
                  className="group flex w-full items-start justify-between gap-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-green rounded-lg p-1"
                >
                  <div className="flex-1">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-green font-semibold mb-1.5">
                      {item.category}
                    </span>
                    <span className="font-serif text-xl sm:text-2xl font-normal text-ink group-hover:text-stone-4 transition-colors">
                      {item.question}
                    </span>
                  </div>

                  <div className="flex size-8 items-center justify-center rounded-full border border-stone-2 bg-ivory text-stone-4 group-hover:border-ink group-hover:text-ink transition-colors shrink-0 mt-1">
                    {isOpen ? (
                      <Minus className="size-4 stroke-[2]" />
                    ) : (
                      <Plus className="size-4 stroke-[2]" />
                    )}
                  </div>
                </button>
              </h3>

              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className="mt-4 pr-10 text-base font-sans leading-relaxed text-stone-4 animate-in fade-in-0 duration-200"
                >
                  <p>{item.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
