"use client";

import React, { useState, useMemo } from "react";
import { Plus, Minus, Search, ChevronDown } from "lucide-react";

export interface FAQItem {
  category: string;
  question: string;
  answer: string;
}

export interface FAQViewProps {
  items: FAQItem[];
  defaultCategory?: string;
  showSearch?: boolean;
}

export function FAQView({ items, defaultCategory = "All", showSearch = true }: FAQViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [openQuestions, setOpenQuestions] = useState<Record<string, boolean>>(() => {
    // Open first question by default
    return items.length > 0 ? { [items[0].question]: true } : {};
  });

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category)));
    return ["All", ...cats];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  const toggleQuestion = (question: string) => {
    setOpenQuestions((prev) => ({
      ...prev,
      [question]: !prev[question],
    }));
  };

  return (
    <div className="w-full space-y-8">
      {/* Category Tabs & Quick Search Row */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-sl-border pb-4">
        {/* Category Tabs (Reference E) */}
        <div
          role="tablist"
          aria-label="FAQ Categories"
          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count = cat === "All" ? items.length : items.filter((i) => i.category === cat).length;

            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-sl-mono text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-sl-accent text-sl-accent-ink font-semibold shadow-sm"
                    : "bg-sl-surface text-sl-text-subtle hover:text-sl-text border border-sl-border hover:border-sl-border-strong"
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected ? "bg-sl-accent-ink/20 text-sl-accent-ink" : "bg-sl-bg text-sl-text-subtle"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input Filter */}
        {showSearch && (
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-sl-text-subtle" />
            <input
              type="search"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-sl-border bg-sl-surface py-1.5 pl-8 pr-3 font-sl-mono text-xs text-sl-text placeholder:text-sl-text-subtle focus:border-sl-accent focus:outline-none focus:ring-1 focus:ring-sl-accent"
            />
          </div>
        )}
      </div>

      {/* Accordion Question List (Reference E & F Pattern) */}
      <div className="divide-y divide-sl-border">
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-sl-mono text-sm text-sl-text-muted">
              No questions found matching your search.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="mt-3 font-sl-mono text-xs text-sl-accent underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isOpen = Boolean(openQuestions[item.question]);
            const panelId = `faq-panel-${idx}`;
            const buttonId = `faq-btn-${idx}`;

            return (
              <div key={item.question} className="py-5 sm:py-6 transition-colors">
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleQuestion(item.question)}
                    className="group flex w-full items-start justify-between gap-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sl-accent rounded-lg p-1"
                  >
                    <div className="flex-1">
                      <span className="block font-sl-mono text-[10px] uppercase tracking-wider text-sl-accent font-semibold mb-1">
                        {item.category}
                      </span>
                      <span className="font-serif text-lg sm:text-xl font-medium text-sl-text group-hover:text-sl-accent transition-colors">
                        {item.question}
                      </span>
                    </div>

                    <div className="flex size-7 items-center justify-center rounded-full border border-sl-border bg-sl-surface text-sl-text-subtle group-hover:border-sl-accent group-hover:text-sl-accent transition-colors shrink-0 mt-1">
                      {isOpen ? (
                        <Minus className="size-3.5 stroke-[2.5]" />
                      ) : (
                        <Plus className="size-3.5 stroke-[2.5]" />
                      )}
                    </div>
                  </button>
                </h3>

                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="mt-3.5 pr-8 pl-1 text-sm sm:text-base leading-relaxed text-sl-text-muted animate-in fade-in-0 duration-200"
                  >
                    <p className="whitespace-pre-line">{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
