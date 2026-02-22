import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseElements } from "@/components/ComponentSidebar";
import ComponentSidebar from "@/components/ComponentSidebar";
import type { Component } from "@/lib/types";

// -- Unit tests for parseElements --

describe("parseElements", () => {
    it("extracts textual and interactive elements, ignores layout tags", () => {
        // parseElements should pick up headings, text, and buttons
        // but skip structural tags like <div> that carry no text meaning.
        const html = `
            <h1 class="text-3xl">Welcome</h1>
            <p>Some intro text here</p>
            <button class="btn">Sign up</button>
            <div class="wrapper">just a wrapper</div>
        `;

        const elements = parseElements(html);
        const tags = elements.map((el) => el.tag);

        expect(tags).toContain("h1");
        expect(tags).toContain("p");
        expect(tags).toContain("button");
        // <div> is not textual or interactive, so it should be filtered out
        expect(tags).not.toContain("div");
    });

    it("deduplicates elements with the same tag and text", () => {
        // Two identical <p> tags should produce only one entry,
        // since showing duplicates in the inspector adds noise.
        const html = `
            <p>Repeated paragraph</p>
            <p>Repeated paragraph</p>
            <p>Different paragraph</p>
        `;

        const elements = parseElements(html);
        const texts = elements.map((el) => el.text);

        expect(texts.filter((t) => t === "Repeated paragraph")).toHaveLength(1);
        expect(texts).toContain("Different paragraph");
    });
});

// -- Interaction tests for the sidebar component --

function makeComponent(overrides: Partial<Component> = {}): Component {
    return {
        id: overrides.id || "comp-1",
        name: overrides.name || "Hero Section",
        type: overrides.type || "hero",
        description: overrides.description || "Main hero banner",
        html: overrides.html || '<h1 class="text-4xl">Welcome</h1><button>Get started</button>',
        order: overrides.order ?? 0,
    };
}

describe("ComponentSidebar interactions", () => {
    it("calls onEditComponent with the component name when clicking edit", async () => {
        const onEdit = vi.fn();
        const user = userEvent.setup();

        render(
            <ComponentSidebar
                components={[makeComponent()]}
                onEditComponent={onEdit}
            />
        );

        // The edit button has a title like "Edit Hero Section"
        const editButton = screen.getByTitle("Edit Hero Section");
        await user.click(editButton);

        // Should pass just the component name (no element text)
        expect(onEdit).toHaveBeenCalledWith("Hero Section");
    });

    it("calls onEditComponent with component name AND element text when editing a submenu item", async () => {
        const onEdit = vi.fn();
        const user = userEvent.setup();

        render(
            <ComponentSidebar
                components={[makeComponent()]}
                onEditComponent={onEdit}
            />
        );

        // First, expand the component to reveal its inner elements.
        // Clicking the component row (not the edit icon) toggles the submenu.
        const componentRow = screen.getByText("Hero Section");
        await user.click(componentRow);

        // Now the submenu shows parsed elements. Click the edit icon
        // next to the "Welcome" heading element.
        const elementEditButton = screen.getByTitle('Edit "Welcome" in Hero Section');
        await user.click(elementEditButton);

        // Should pass both the component name and the element's text
        expect(onEdit).toHaveBeenCalledWith("Hero Section", "Welcome");
    });
});
