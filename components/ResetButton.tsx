"use client";

interface ResetButtonProps {
    onReset: () => Promise<void>;
    disabled: boolean;
}

export default function ResetButton({ onReset, disabled }: ResetButtonProps) {
    return (
        <button
            onClick={onReset}
            disabled={disabled}
            className="text-[11px] font-medium text-stone-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 group"
            title="Clear entire session"
        >
            <svg
                className="w-3.5 h-3.5 group-hover:-rotate-180 transition-transform duration-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
            >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
        </button>
    );
}
