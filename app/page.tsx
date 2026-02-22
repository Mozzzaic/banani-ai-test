"use client";

import { useEffect, useState } from "react";
import { Message, Screen } from "@/lib/types";
import ComponentSidebar from "@/components/ComponentSidebar";
import ScreenRenderer from "@/components/ScreenRenderer";
import PromptBox from "@/components/PromptBox";
import ResetButton from "@/components/ResetButton";

interface ParsedSseEvent {
  type: string;
  data: unknown;
}

function splitSseBuffer(buffer: string): { completeEvents: string[]; pending: string } {
  // SSE events are separated by blank lines. Keep the last incomplete chunk
  // in the buffer until the next network packet arrives.
  const parts = buffer.split("\n\n");
  const pending = parts.pop() || "";
  return { completeEvents: parts, pending };
}

function parseSseEventBlock(block: string): ParsedSseEvent | null {
  const lines = block.trim().split("\n");
  const eventLine = lines.find((line) => line.startsWith("event: "));
  const dataLine = lines.find((line) => line.startsWith("data: "));
  if (!eventLine || !dataLine) return null;

  const type = eventLine.slice("event: ".length);
  const rawData = dataLine.slice("data: ".length);

  try {
    return {
      type,
      data: JSON.parse(rawData) as unknown,
    };
  } catch {
    return null;
  }
}

function hasMessage(data: unknown): data is { message: string } {
  return Boolean(
    data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
  );
}

function hasError(data: unknown): data is { error: string } {
  return Boolean(
    data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
  );
}

function hasScreenAndMessages(data: unknown): data is { screen: Screen | null; messages: Message[] } {
  if (!data || typeof data !== "object") return false;
  if (!("messages" in data) || !Array.isArray((data as { messages?: unknown }).messages)) return false;
  return "screen" in data;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [screen, setScreen] = useState<Screen | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [promptFocusSignal, setPromptFocusSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/session", { method: "GET", cache: "no-store" });
        if (!response.ok) return;

        const payload = await response.json();
        if (cancelled) return;

        if (Array.isArray(payload.messages)) {
          setMessages(payload.messages as Message[]);
        }

        if ("screen" in payload) {
          setScreen(payload.screen as Screen | null);
        }
      } catch (error) {
        console.error("Failed to load session", error);
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSendPrompt = async (prompt: string) => {
    setIsLoading(true);
    setStatusMessage("");
    setDraftPrompt("");
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to generate screen from prompt");
      }

      // Stream parser: read chunks, rebuild full SSE events, then handle each event.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const { completeEvents, pending } = splitSseBuffer(buffer);
        buffer = pending;

        for (const rawEvent of completeEvents) {
          const parsedEvent = parseSseEventBlock(rawEvent);
          if (!parsedEvent) continue;

          if (parsedEvent.type === "status" && hasMessage(parsedEvent.data)) {
            setStatusMessage(parsedEvent.data.message);
          } else if (parsedEvent.type === "done" && hasScreenAndMessages(parsedEvent.data)) {
            setScreen(parsedEvent.data.screen);
            setMessages(parsedEvent.data.messages);
          } else if (parsedEvent.type === "error" && hasError(parsedEvent.data)) {
            throw new Error(parsedEvent.data.error);
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error fulfilling that request." },
      ]);
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  const handleResetSession = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/reset", { method: "POST" });
      setMessages([]);
      setScreen(null);
      setDraftPrompt("");
    } catch (error) {
      console.error("Failed to reset the session", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex h-screen w-full bg-[var(--background)] overflow-hidden font-sans relative">
      {/* Sidebar */}
      <ComponentSidebar
        components={screen?.components || []}
        onHoverComponent={setHoveredComponentId}
        onEditComponent={(name, elementText) => {
          const prefix = `In the ${name}`;
          setDraftPrompt(elementText ? `${prefix}, change the "${elementText}" — ` : `${prefix}: `);
          setPromptFocusSignal((value) => value + 1);
        }}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col relative h-full min-w-0">
        {/* Top bar — frosted glass */}
        <div className="h-12 border-b border-[var(--border)]/50 flex items-center justify-between px-5 backdrop-blur-xl bg-[var(--background)]/70 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${screen ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" : "bg-stone-300"}`} />
            <span className="text-[11px] font-semibold text-stone-400 tracking-[0.15em] uppercase">
              {screen ? "Live Preview" : "Canvas"}
            </span>
            {screen && (
              <span className="text-[10px] font-mono text-stone-400 bg-[var(--surface)] px-2 py-0.5 rounded-md ring-1 ring-[var(--border)]/40">
                {screen.components.length} layers
              </span>
            )}
          </div>
          <ResetButton onReset={handleResetSession} disabled={isLoading} />
        </div>

        {/* Canvas — the generated UI lives here */}
        <div className="flex-1 min-h-0 p-4">
          <ScreenRenderer htmlContent={screen?.assembledHtml || ""} highlightedComponentId={hoveredComponentId} />
        </div>

        {/* Chat panel */}
        <div className="h-72 border-t border-[var(--border)]/50 shrink-0 backdrop-blur-xl bg-[var(--background)]/60">
          <PromptBox
            onSend={handleSendPrompt}
            isLoading={isLoading}
            statusMessage={statusMessage}
            messages={messages}
            value={draftPrompt}
            onValueChange={setDraftPrompt}
            focusSignal={promptFocusSignal}
          />
        </div>
      </div>
    </main>
  );
}
