"use client";

import { useRef, useEffect, useCallback } from "react";

interface ScreenRendererProps {
    htmlContent: string;
    highlightedComponentId?: string | null;
    isLoading?: boolean;
    statusMessage?: string;
}

export default function ScreenRenderer({ htmlContent, highlightedComponentId, isLoading, statusMessage }: ScreenRendererProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const sendHighlight = useCallback((id: string | null) => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;
        iframe.contentWindow.postMessage(
            { type: "highlight-component", id },
            "*"
        );
    }, []);

    // Send current highlight after each iframe load.
    const handleIframeLoad = useCallback(() => {
        sendHighlight(highlightedComponentId || null);
    }, [highlightedComponentId, sendHighlight]);

    // Keep iframe highlight in sync with sidebar hover.
    useEffect(() => {
        if (!htmlContent) return;
        sendHighlight(highlightedComponentId || null);
    }, [highlightedComponentId, htmlContent, sendHighlight]);

    return (
        <div className="w-full h-full flex flex-col relative">
            {/* Loading skeleton — shown while the agent generates components */}
            {isLoading && !htmlContent && (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="flex flex-col items-center gap-4 max-w-sm text-center">
                        <div className="w-full space-y-3 animate-pulse">
                            <div className="h-10 bg-stone-200/60 rounded-lg w-full" />
                            <div className="h-48 bg-stone-200/40 rounded-xl w-full" />
                            <div className="grid grid-cols-3 gap-3">
                                <div className="h-28 bg-stone-200/40 rounded-lg" />
                                <div className="h-28 bg-stone-200/40 rounded-lg" />
                                <div className="h-28 bg-stone-200/40 rounded-lg" />
                            </div>
                            <div className="h-20 bg-stone-200/40 rounded-lg w-full" />
                        </div>
                        <p className="text-xs text-stone-400 mt-2 transition-all duration-300">
                            {statusMessage || "Generating..."}
                        </p>
                    </div>
                </div>
            )}

            {/* Empty state — no screen and not loading */}
            {!htmlContent && !isLoading && (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="flex flex-col items-center gap-3 max-w-xs text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] flex items-center justify-center">
                            <svg className="w-6 h-6 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-stone-400">No screen yet</p>
                            <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                                Describe what you want to build in the prompt box below.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Live preview iframe */}
            {htmlContent && (
                <iframe
                    ref={iframeRef}
                    srcDoc={htmlContent}
                    className="w-full h-full border-none rounded-lg shadow-sm ring-1 ring-[var(--border)]"
                    sandbox="allow-scripts"
                    title="Generated UI"
                    onLoad={handleIframeLoad}
                />
            )}

            {/* Loading overlay — shown when regenerating an existing screen */}
            {isLoading && htmlContent && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-lg z-10">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                        <p className="text-xs text-stone-500 font-medium">
                            {statusMessage || "Updating..."}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
