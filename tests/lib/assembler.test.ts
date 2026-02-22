import { describe, expect, it } from "vitest";
import { assembleScreen } from "@/lib/assembler";
import type { Component } from "@/lib/types";

function makeComponent(partial: Partial<Component>): Component {
    return {
        id: partial.id || crypto.randomUUID(),
        name: partial.name || "Section",
        type: partial.type || "section",
        description: partial.description || "Generic section",
        html: partial.html || "<section>Content</section>",
        order: partial.order ?? 0,
    };
}

describe("assembleScreen", () => {
    it("sorts components by order before composing HTML", () => {
        const first = makeComponent({ id: "first", order: 0, html: "<section>First</section>" });
        const second = makeComponent({ id: "second", order: 1, html: "<section>Second</section>" });
        const html = assembleScreen([second, first]);

        expect(html.indexOf("First")).toBeLessThan(html.indexOf("Second"));
    });

    it("adds data-component-id wrappers for highlight targeting", () => {
        const component = makeComponent({ id: "hero-id", name: "Hero" });
        const html = assembleScreen([component]);

        expect(html).toContain('data-component-id="hero-id"');
        expect(html).toContain("Component: Hero");
    });
});
