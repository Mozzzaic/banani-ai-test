"use client";

import { Message } from "@/lib/types";
import { useRef, useEffect } from "react";

interface PromptBoxProps {
    onSend: (prompt: string) => Promise<void>;
    isLoading: boolean;
    statusMessage: string;
    messages: Message[];
    value: string;
    onValueChange: (nextValue: string) => void;
    focusSignal?: number;
}

export default function PromptBox({
    onSend,
    isLoading,
    statusMessage,
    messages,
    value,
    onValueChange,
    focusSignal = 0
}: PromptBoxProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to latest message or status update
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, statusMessage]);

    // Sidebar edits bump this signal so we can focus the prompt instantly.
    useEffect(() => {
        if (focusSignal > 0) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [focusSignal]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!value.trim() || isLoading) return;
        const currentInput = value;
        onValueChange("");
        await onSend(currentInput);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--background)]">
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-xs text-stone-300">Your conversation will appear here.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-xl px-3.5 py-2 text-[13px] leading-relaxed ${
                                    msg.role === "user"
                                        ? "bg-stone-700 text-white"
                                        : "bg-[var(--surface)] text-stone-600 border border-[var(--border)]"
                                }`}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-[pulse_1.4s_ease-in-out_infinite] shrink-0" />
                            <span className="text-[12px] text-stone-400 transition-all duration-300">
                                {statusMessage || "Thinking..."}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2">
                <div className="flex gap-2 items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-400/20 focus:border-stone-300 transition-shadow"
                        placeholder="Describe the screen you want to build..."
                        value={value}
                        onChange={(e) => onValueChange(e.target.value)}
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !value.trim()}
                        className="h-10 w-10 rounded-xl bg-stone-700 hover:bg-stone-800 text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    >
                        {isLoading ? (
                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                            </svg>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
