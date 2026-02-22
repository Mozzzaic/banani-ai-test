// A single UI component that lives inside a screen.
export interface Component {
  id: string;
  name: string;
  type: string;        // semantic category: "hero", "navbar", "card_grid", etc.
  html: string;        // raw HTML fragment (no <html>/<body> wrapper)
  order: number;       // position in the assembled screen
  description: string; // what it does — fed back to the Router for context
}

// A composed screen made of multiple components.
export interface Screen {
  components: Component[];
  assembledHtml: string;  // full HTML document ready for iframe rendering
  styleGuide?: string;    // shared design tokens from the initial generation, reused on updates
}

// A single chat message.
export interface Message {
  role: "user" | "assistant";
  content: string;
}

// The full state of a user session.
export interface SessionState {
  messages: Message[];
  screen: Screen | null;
}
