"use client";

import { Component } from "@/lib/types";
import { useState, useMemo } from "react";

/** Lightweight representation of a parsed HTML element for the submenu */
interface ElementNode {
    tag: string;
    text: string;
    className: string;
}

const PARSABLE_TAGS = [
    "h[1-6]",
    "p",
    "a",
    "button",
    "img",
    "input",
    "span",
    "li",
    "label",
    "nav",
    "section",
    "header",
    "footer",
    "form",
    "table",
    "ul",
    "ol",
    "div",
    "textarea",
    "select",
];

const INTERACTIVE_TAGS = new Set(["button", "a", "input", "select", "textarea", "img", "form"]);
const TEXTUAL_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "label", "li", "span"]);

/** Parse a component's HTML string into a flat list of meaningful elements.
 *  Exported so we can unit-test the parsing logic directly. */
export function parseElements(html: string): ElementNode[] {
    const elements: ElementNode[] = [];

    // This regex is intentionally shallow: we only need a quick inspector list,
    // not a full HTML parser. It works well enough for generated snippets.
    const tagPattern = PARSABLE_TAGS.join("|");
    const tagRegex = new RegExp(`<(${tagPattern})([^>]*)>([\\s\\S]*?)<\\/\\1>`, "gi");

    let match;
    const seen = new Set<string>();
    while ((match = tagRegex.exec(html)) !== null) {
        const tag = match[1].toLowerCase();
        const attrs = match[2];
        const innerHtml = match[3];
        // Extract text content (strip nested tags)
        const text = innerHtml.replace(/<[^>]+>/g, "").trim();
        // Extract class for context
        const classMatch = attrs.match(/class="([^"]*)"/);
        const className = classMatch?.[1] || "";
        // Only include elements that carry meaningful text or are interactive
        const isInteractive = INTERACTIVE_TAGS.has(tag);
        const isTextual = TEXTUAL_TAGS.has(tag);
        if (!isInteractive && !isTextual) continue;
        if (!isInteractive && !text) continue;
        // De-duplicate by tag+text
        const key = `${tag}:${text.slice(0, 60)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        elements.push({
            tag,
            text: text.slice(0, 50) || (tag === "img" ? "image" : tag),
            className,
        });
    }
    return elements.slice(0, 15); // cap to avoid massive lists
}

/** Human-friendly label and icon for each tag */
function tagMeta(tag: string): { label: string; icon: string } {
    const map: Record<string, { label: string; icon: string }> = {
        h1: { label: "Heading", icon: "H1" },
        h2: { label: "Heading", icon: "H2" },
        h3: { label: "Heading", icon: "H3" },
        h4: { label: "Heading", icon: "H4" },
        h5: { label: "Heading", icon: "H5" },
        h6: { label: "Heading", icon: "H6" },
        p: { label: "Text", icon: "P" },
        a: { label: "Link", icon: "A" },
        button: { label: "Button", icon: "Btn" },
        img: { label: "Image", icon: "Img" },
        input: { label: "Input", icon: "In" },
        textarea: { label: "Textarea", icon: "Tx" },
        select: { label: "Select", icon: "Sel" },
        span: { label: "Text", icon: "Sp" },
        li: { label: "List item", icon: "Li" },
        label: { label: "Label", icon: "Lb" },
        form: { label: "Form", icon: "Fm" },
    };
    return map[tag] || { label: tag, icon: tag.slice(0, 2).toUpperCase() };
}

interface ComponentSidebarProps {
    components: Component[];
    onHoverComponent?: (id: string | null) => void;
    onEditComponent?: (componentName: string, elementText?: string) => void;
}

export default function ComponentSidebar({ components, onHoverComponent, onEditComponent }: ComponentSidebarProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Parse elements for all components (memoized)
    const elementsMap = useMemo(() => {
        const map = new Map<string, ElementNode[]>();
        components.forEach((comp) => {
            map.set(comp.id, parseElements(comp.html));
        });
        return map;
    }, [components]);

    return (
        <div className="w-72 bg-[var(--background)] h-full flex flex-col border-r border-stone-200/60 shrink-0">
            {/* Branding + header */}
            <div className="px-5 pt-5 pb-4 border-b border-stone-200/40">
                <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-stone-700 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                        </svg>
                    </div>
                    <span className="text-sm font-semibold text-stone-700 tracking-tight">Banani AI</span>
                </div>
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-stone-400 tracking-widest uppercase">Components</h2>
                    <span className="text-[10px] font-mono text-stone-300 tabular-nums">
                        {components.length}
                    </span>
                </div>
            </div>

            {/* Component list */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                {components.length === 0 ? (
                    <div className="text-center text-stone-400 text-xs py-10 px-4 leading-relaxed">
                        <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-stone-200/40 flex items-center justify-center mx-auto mb-3">
                            <svg className="w-5 h-5 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                        Describe a UI below to see the component breakdown here.
                    </div>
                ) : (
                    components.map((comp) => {
                        const isExpanded = expandedId === comp.id;
                        const elements = elementsMap.get(comp.id) || [];

                        return (
                            <div
                                key={comp.id}
                                className="rounded-lg transition-colors border border-transparent hover:border-blue-400/60"
                                onMouseEnter={() => onHoverComponent?.(comp.id)}
                                onMouseLeave={() => onHoverComponent?.(null)}
                            >
                                {/* Component header */}
                                <div
                                    className="flex items-center gap-2 p-3 cursor-pointer hover:bg-[var(--surface)] rounded-lg"
                                    onClick={() => setExpandedId(isExpanded ? null : comp.id)}
                                >
                                    {/* Expand chevron */}
                                    <svg
                                        className={`w-3 h-3 text-stone-300 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2.5}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-stone-700 text-[13px] truncate pr-2">
                                                {comp.name}
                                            </span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-[var(--surface)] text-stone-400">
                                                    {comp.type}
                                                </span>
                                                {/* Edit button */}
                                                <button
                                                    className="w-5 h-5 rounded flex items-center justify-center text-stone-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditComponent?.(comp.name);
                                                    }}
                                                    title={`Edit ${comp.name}`}
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1 leading-relaxed">
                                            {comp.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Expandable element submenu */}
                                {isExpanded && (
                                    <div className="px-3 pb-2.5">
                                        <div className="ml-4 border-l border-stone-200/60 pl-3 space-y-0.5">
                                            {elements.length === 0 ? (
                                                <p className="text-[10px] text-stone-300 py-1 italic">No parseable elements</p>
                                            ) : (
                                                elements.map((el, idx) => {
                                                    const meta = tagMeta(el.tag);
                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--surface)] group/el"
                                                        >
                                                            <span className="text-[8px] font-mono font-bold text-stone-300 bg-stone-100 rounded px-1 py-0.5 w-6 text-center shrink-0 uppercase">
                                                                {meta.icon}
                                                            </span>
                                                            <span className="text-[11px] text-stone-500 truncate flex-1">
                                                                {el.text}
                                                            </span>
                                                            {/* Edit this specific element */}
                                                            <button
                                                                className="w-4 h-4 rounded flex items-center justify-center text-stone-200 hover:text-blue-500 opacity-0 group-hover/el:opacity-100 transition-all"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onEditComponent?.(comp.name, el.text);
                                                                }}
                                                                title={`Edit "${el.text}" in ${comp.name}`}
                                                            >
                                                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
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
