import { Component } from "./types";

// Takes a list of components and produces a complete HTML document
// ready to be rendered in an iframe (with Tailwind CDN included).
export function assembleScreen(components: Component[]): string {
    const sortedComponents = [...components].sort((a, b) => a.order - b.order);

    // Each component gets a wrapper div with a data attribute so we can highlight it from the sidebar.
    const bodyHtml = sortedComponents
        .map((c) => {
            return `\n    <!-- [START] Component: ${c.name} (Type: ${c.type} | ID: ${c.id}) -->\n    <div data-component-id="${c.id}" style="transition: outline 0.15s ease, outline-offset 0.15s ease;">\n    ${c.html}\n    </div>\n    <!-- [END] Component: ${c.name} -->`;
        })
        .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Screen Component</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen">
    ${bodyHtml}
    <script>
    window.addEventListener('message', (e) => {
        if (e.data?.type !== 'highlight-component') return;
        const targetId = e.data.id;
        document.querySelectorAll('[data-component-id]').forEach(wrapper => {
            const isTarget = wrapper.dataset.componentId === targetId;
            const style = isTarget ? '2px solid #3b82f6' : '';
            const offset = isTarget ? '2px' : '';
            wrapper.style.outline = style;
            wrapper.style.outlineOffset = offset;
            // Also highlight direct children — handles fixed/sticky positioned elements
            // (e.g. navbars, footers) that escape the wrapper visually
            Array.from(wrapper.children).forEach(child => {
                child.style.outline = style;
                child.style.outlineOffset = offset;
            });
        });
    });
    </script>
</body>
</html>`;
}
