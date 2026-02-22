import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ScreenRenderer from "@/components/ScreenRenderer";

describe("ScreenRenderer", () => {
    it("shows the empty state when no html content is provided", () => {
        render(<ScreenRenderer htmlContent="" highlightedComponentId={null} />);
        expect(screen.getByText("No screen yet")).toBeInTheDocument();
    });

    it("sends highlight messages on iframe load and when highlight changes", () => {
        const { rerender } = render(
            <ScreenRenderer
                htmlContent="<html><body><div>Preview</div></body></html>"
                highlightedComponentId="comp-1"
            />
        );

        const iframe = screen.getByTitle("Generated UI") as HTMLIFrameElement;
        const postMessage = vi.fn();
        Object.defineProperty(iframe, "contentWindow", {
            configurable: true,
            value: { postMessage },
        });

        fireEvent.load(iframe);
        expect(postMessage).toHaveBeenCalledWith(
            { type: "highlight-component", id: "comp-1" },
            "*"
        );

        rerender(
            <ScreenRenderer
                htmlContent="<html><body><div>Preview</div></body></html>"
                highlightedComponentId="comp-2"
            />
        );
        expect(postMessage).toHaveBeenLastCalledWith(
            { type: "highlight-component", id: "comp-2" },
            "*"
        );
    });
});
