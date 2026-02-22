import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PromptBox from "@/components/PromptBox";

describe("PromptBox", () => {
    it("submits controlled value and asks parent to clear it", async () => {
        const user = userEvent.setup();
        const onSend = vi.fn(async () => {});
        const onValueChange = vi.fn();

        render(
            <PromptBox
                onSend={onSend}
                isLoading={false}
                statusMessage=""
                messages={[]}
                value="Build a dashboard"
                onValueChange={onValueChange}
                focusSignal={0}
            />
        );

        await user.click(screen.getByRole("button"));

        expect(onValueChange).toHaveBeenCalledWith("");
        expect(onSend).toHaveBeenCalledWith("Build a dashboard");
    });
});
