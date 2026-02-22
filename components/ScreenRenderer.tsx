"use client";

import { useRef, useEffect, useCallback } from "react";

interface ScreenRendererProps {
    htmlContent: string;
    highlightedComponentId?: string | null;
}

export default function ScreenRenderer({ htmlContent, highlightedComponentId }: ScreenRendererProps) {
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
            {!htmlContent ? (
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
            ) : (
                <iframe
                    ref={iframeRef}
                    srcDoc={htmlContent}
                    className="w-full h-full border-none bg-white rounded-lg shadow-sm ring-1 ring-[var(--border)]"
                    sandbox="allow-scripts"
                    title="Generated UI"
                    onLoad={handleIframeLoad}
                />
            )}
        </div>
    );
}
