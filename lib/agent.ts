import { GoogleGenAI, FunctionCallingConfigMode, type FunctionDeclaration } from '@google/genai';
import { SessionState, Component, Screen } from './types';
import { assembleScreen } from './assembler';

const ROUTER_MODEL = "gemini-2.5-flash";      // fast, cheap — just picks the right tool
const GENERATOR_MODEL = "gemini-2.5-pro";          // stable, high-quality HTML output

// Lazy init so env vars are available at request time (not module load).
let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
    if (!_client) {
        _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return _client;
}

// Strip markdown fences and full-document wrappers that the LLM sometimes adds.
function cleanHtml(raw: string): string {
    let html = raw.replace(/^```(?:html)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    // If the LLM returned a full document, extract only the <body> inner content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
        html = bodyMatch[1].trim();
    }

    return html;
}

// The three tools the Router can pick from.
const TOOL_DECLARATIONS: FunctionDeclaration[] = [
    {
        name: "generate_screen",
        description: "Generate a completely new screen from scratch.",
        parametersJsonSchema: {
            type: "object",
            properties: {
                screen_description: { type: "string" },
                style_guide: {
                    type: "string",
                    description: "Shared design rules all components must follow (e.g. 'Dark theme, bg-gray-900, accent indigo-500, rounded-xl cards, Inter font')"
                },
                components: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            type: { type: "string" },
                            description: { type: "string" }
                        },
                        required: ["name", "type", "description"]
                    }
                }
            },
            required: ["screen_description", "style_guide", "components"]
        }
    },
    {
        name: "update_components",
        description: "Apply style or text updates to existing components.",
        parametersJsonSchema: {
            type: "object",
            properties: {
                updates: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            component_id: { type: "string" },
                            instruction: { type: "string" }
                        },
                        required: ["component_id", "instruction"]
                    }
                }
            },
            required: ["updates"]
        }
    },
    {
        name: "regenerate_screen",
        description: "Restructure an existing screen with new or retained components.",
        parametersJsonSchema: {
            type: "object",
            properties: {
                instruction: { type: "string" },
                components: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            type: { type: "string" },
                            description: { type: "string" },
                            keep_from_id: { type: "string", description: "ID of the existing component to keep" }
                        },
                        required: ["name", "type", "description"]
                    }
                }
            },
            required: ["instruction", "components"]
        }
    }
];

// Main entry point. Runs the two-phase flow: Router picks a tool, Executor generates HTML.
// The optional onStatus callback pushes SSE progress messages to the client.
export async function processPrompt(
    userPrompt: string,
    session: SessionState,
    onStatus?: (message: string) => void
): Promise<SessionState> {
    const emit = onStatus || (() => {});

    const history = [...session.messages, { role: "user" as const, content: userPrompt }];

    // PHASE 1: ROUTER
    emit("Analyzing your request...");

    const systemPrompt = `
You are a UI routing expert. Your job is to pick the right action to fulfill the user's request.
Current screen components:
${session.screen?.components?.map(c => `- [${c.id}] ${c.name} (${c.type}): ${c.description}`).join('\n') || "None. The screen is empty."}

RULES:
- If no components exist, YOU MUST call generate_screen.
- If it's pure styling or content updates to existing items, call update_components.
- If it changes the core structure (adding/removing items), call regenerate_screen.

DECOMPOSITION:
- Each component is a self-contained, full-width section (navbar, hero, feature grid, CTA, footer, etc.).
- A grid of cards is ONE component. Do NOT create separate components for each card.
- Aim for 4-6 components per screen.
    `.trim();

    // Gemini expects "model" instead of "assistant" for the AI role.
    const geminiHistory = history.map(m => ({
        role: m.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: m.content }]
    }));

    const routerResponse = await getClient().models.generateContent({
        model: ROUTER_MODEL,
        contents: geminiHistory,
        config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
            toolConfig: {
                functionCallingConfig: { mode: FunctionCallingConfigMode.ANY }
            }
        }
    });

    const toolCall = routerResponse.functionCalls?.[0];
    if (!toolCall) {
        throw new Error("Router failed to select a tool.");
    }

    // Generates HTML for a single component. Retries on transient network errors.
    async function generateComponentHtml(prompt: string, styleGuide?: string): Promise<string> {
        let system = `You are an expert frontend developer. Generate a single, self-contained HTML component using Tailwind CSS classes.
Return ONLY the raw HTML fragment — no <!DOCTYPE>, <html>, <head>, <body>, or <script> tags.
This component will be placed inside a page alongside other components, so do NOT use min-h-screen or full-page wrappers.
Use realistic, specific placeholder text that feels human-written. Never use em-dashes (—) or generic marketing fluff.
The current year is 2026. Use 2026 for any copyright notices or dates.`;
        if (styleGuide) {
            system += `\nStyle guide to follow: ${styleGuide}`;
        }

        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await getClient().models.generateContent({
                    model: GENERATOR_MODEL,
                    contents: prompt,
                    config: { systemInstruction: system }
                });
                const raw = res.text || "";
                return cleanHtml(raw);
            } catch (err) {
                if (attempt === MAX_RETRIES) throw err;
                // brief backoff before retrying
                await new Promise(r => setTimeout(r, attempt * 1000));
            }
        }
        throw new Error("unreachable");
    }

    // Keep the style guide around so follow-up changes stay visually consistent.
    const existingStyleGuide = session.screen?.styleGuide;

    const finalScreen: Screen = session.screen
        ? { ...session.screen }
        : { components: [], assembledHtml: "", styleGuide: undefined };
    let newComponents: Component[] = [];
    let assistantMessage = "";

    // PHASE 2: EXECUTOR — run the tool the Router picked.
    if (toolCall.name === "generate_screen") {
        const input = toolCall.args as { screen_description: string; style_guide?: string; components: Omit<Component, "id" | "html" | "order">[] };

        emit(`Breaking down into ${input.components.length} components...`);

        // Save the style guide so future updates keep the same look.
        finalScreen.styleGuide = input.style_guide;

        newComponents = await Promise.all(
            input.components.map(async (c, i) => {
                // Small delay between parallel calls to avoid overwhelming the API.
                await new Promise(r => setTimeout(r, i * 300));
                emit(`Generating ${c.name}...`);
                const html = await generateComponentHtml(
                    `Create a ${c.type} named "${c.name}" for the screen: "${input.screen_description}". Description: ${c.description}`,
                    input.style_guide
                );
                return {
                    id: crypto.randomUUID(),
                    order: i,
                    name: c.name,
                    type: c.type,
                    description: c.description,
                    html,
                };
            })
        );

        const names = newComponents.map(c => c.name).join(", ");
        assistantMessage = `Generated a new screen with ${newComponents.length} components: ${names}.`;

    } else if (toolCall.name === "update_components") {
        const input = toolCall.args as { updates: { component_id: string; instruction: string }[] };
        const currentComponents = session.screen?.components || [];

        const targetNames = input.updates
            .map(u => currentComponents.find(c => c.id === u.component_id)?.name || "component")
            .join(", ");
        emit(`Updating ${targetNames}...`);

        newComponents = await Promise.all(
            currentComponents.map(async (c) => {
                const update = input.updates.find((u) => u.component_id === c.id);
                if (!update) {
                    return c; // untouched, keep as-is
                }
                emit(`Rewriting ${c.name}...`);
                // pass the style guide so the update stays consistent with the rest
                const updatedHtml = await generateComponentHtml(
                    `Update this existing component. Apply the following instruction: ${update.instruction}\n\nCurrent HTML:\n${c.html}`,
                    existingStyleGuide
                );
                return { ...c, html: updatedHtml };
            })
        );

        const updatedNames = input.updates
            .map(u => {
                const comp = currentComponents.find(c => c.id === u.component_id);
                return comp ? `${comp.name} (${u.instruction})` : u.component_id;
            })
            .join(", ");
        assistantMessage = `Updated ${input.updates.length} component${input.updates.length === 1 ? "" : "s"}: ${updatedNames}.`;

    } else if (toolCall.name === "regenerate_screen") {
        const input = toolCall.args as { instruction: string; components: (Omit<Component, "id" | "html" | "order"> & { keep_from_id?: string })[] };
        const currentComponentsMap = new Map((session.screen?.components || []).map(c => [c.id, c]));

        emit(`Restructuring layout with ${input.components.length} components...`);

        newComponents = await Promise.all(
            input.components.map(async (c, i) => {
                // reuse existing HTML if the router said to keep this one
                if (c.keep_from_id && currentComponentsMap.has(c.keep_from_id)) {
                    const existing = currentComponentsMap.get(c.keep_from_id)!;
                    return {
                        ...existing,
                        order: i,
                        name: c.name,
                        type: c.type,
                        description: c.description,
                    };
                }

                emit(`Generating ${c.name}...`);
                const html = await generateComponentHtml(
                    `Create a ${c.type} named ${c.name} based on the overall instruction: ${input.instruction}. Description: ${c.description}`,
                    existingStyleGuide
                );
                return {
                    id: crypto.randomUUID(),
                    order: i,
                    name: c.name,
                    type: c.type,
                    description: c.description,
                    html,
                };
            })
        );

        const kept = input.components.filter(c => c.keep_from_id).map(c => c.name);
        const created = input.components.filter(c => !c.keep_from_id).map(c => c.name);
        const parts: string[] = [];
        if (kept.length) parts.push(`kept ${kept.join(", ")}`);
        if (created.length) parts.push(`created ${created.join(", ")}`);
        assistantMessage = `Restructured the screen (${parts.join("; ")}). ${newComponents.length} components total.`;
    }

    // Assemble the final HTML document from all components.
    emit("Assembling final screen...");
    finalScreen.components = newComponents;
    finalScreen.assembledHtml = assembleScreen(newComponents);

    return {
        messages: [
            ...history,
            { role: "assistant", content: assistantMessage || "Done!" }
        ],
        screen: finalScreen,
    };
}
