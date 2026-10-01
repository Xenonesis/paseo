// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  buildInspectTargetInfo,
  extractAccessibility,
  extractComputedStyles,
  extractHtmlSnippet,
  extractNearbyContext,
  extractReactFiberInfo,
  generateHierarchicalSelector,
} from "./interactive-inspect-overlay";

describe("interactive-inspect-overlay extractors", () => {
  describe("generateHierarchicalSelector", () => {
    it("generates tag#id for element with id", () => {
      const container = document.createElement("div");
      const button = document.createElement("button");
      button.id = "submit-btn";
      container.appendChild(button);
      document.body.appendChild(container);

      const selector = generateHierarchicalSelector(button);
      expect(selector).toBe("button#submit-btn");

      document.body.removeChild(container);
    });

    it("generates tag.class hierarchy for nested elements", () => {
      const container = document.createElement("div");
      container.className = "card-container";
      const section = document.createElement("section");
      section.className = "card-body";
      const button = document.createElement("button");
      button.className = "btn btn-primary";
      section.appendChild(button);
      container.appendChild(section);
      document.body.appendChild(container);

      const selector = generateHierarchicalSelector(button);
      expect(selector).toBe("div.card-container > section.card-body > button.btn.btn-primary");

      document.body.removeChild(container);
    });

    it("uses nth-of-type for same-tag siblings", () => {
      const list = document.createElement("ul");
      list.className = "nav-list";
      const li1 = document.createElement("li");
      const li2 = document.createElement("li");
      const li3 = document.createElement("li");
      list.appendChild(li1);
      list.appendChild(li2);
      list.appendChild(li3);
      document.body.appendChild(list);

      const selector = generateHierarchicalSelector(li2);
      expect(selector).toBe("ul.nav-list > li:nth-of-type(2)");

      document.body.removeChild(list);
    });
  });

  describe("extractReactFiberInfo", () => {
    it("returns empty info for non-fiber elements", () => {
      const div = document.createElement("div");
      const info = extractReactFiberInfo(div);
      expect(info.component).toBeUndefined();
      expect(info.source).toBeUndefined();
    });

    it("extracts component name and source from React fiber chain", () => {
      const button = document.createElement("button");
      const fiberObj = {
        tag: 5,
        type: "button",
        _debugSource: {
          fileName: "src/components/action-button.tsx",
          lineNumber: 42,
        },
        return: {
          tag: 0,
          type: function ActionButton() {},
          return: {
            tag: 1,
            type: { displayName: "Fragment" },
            return: null,
          },
        },
      };

      (button as unknown as Record<string, unknown>)["__reactFiber$test123"] = fiberObj;

      const info = extractReactFiberInfo(button);
      expect(info.component).toBe("ActionButton");
      expect(info.source).toBe("src/components/action-button.tsx:42");
    });

    it("filters out internal React wrappers like Provider and Router", () => {
      const div = document.createElement("div");
      const fiberObj = {
        tag: 5,
        type: "div",
        return: {
          tag: 0,
          type: { displayName: "ThemeContext.Provider" },
          return: {
            tag: 0,
            type: { name: "BrowserRouter" },
            return: {
              tag: 0,
              type: function UserProfileCard() {},
              return: null,
            },
          },
        },
      };

      (div as unknown as Record<string, unknown>)["__reactFiber$abc"] = fiberObj;

      const info = extractReactFiberInfo(div);
      expect(info.component).toBe("UserProfileCard");
    });
  });

  describe("extractComputedStyles", () => {
    it("captures computed styles correctly", () => {
      const el = document.createElement("div");
      el.style.display = "flex";
      el.style.position = "relative";
      el.style.color = "rgb(0, 0, 0)";
      document.body.appendChild(el);

      const styles = extractComputedStyles(el);
      expect(styles).toBeDefined();
      expect(styles?.display).toBe("flex");
      expect(styles?.position).toBe("relative");
      expect(styles?.color).toBe("rgb(0, 0, 0)");

      document.body.removeChild(el);
    });
  });

  describe("extractAccessibility", () => {
    it("extracts explicit role and aria-label", () => {
      const el = document.createElement("div");
      el.setAttribute("role", "alert");
      el.setAttribute("aria-label", "Warning message");

      const acc = extractAccessibility(el);
      expect(acc).toBeDefined();
      expect(acc?.role).toBe("alert");
      expect(acc?.ariaLabel).toBe("Warning message");
      expect(acc?.accessibleName).toBe("Warning message");
    });

    it("infers implicit role and textContent accessible name for button", () => {
      const button = document.createElement("button");
      button.textContent = "Confirm Order";

      const acc = extractAccessibility(button);
      expect(acc).toBeDefined();
      expect(acc?.role).toBe("button");
      expect(acc?.accessibleName).toBe("Confirm Order");
    });
  });

  describe("extractNearbyContext", () => {
    it("extracts previous and next sibling context", () => {
      const parent = document.createElement("div");
      const prev = document.createElement("span");
      prev.textContent = "Previous Item";
      const target = document.createElement("span");
      target.textContent = "Current Item";
      const next = document.createElement("span");
      next.textContent = "Next Item";

      parent.appendChild(prev);
      parent.appendChild(target);
      parent.appendChild(next);
      document.body.appendChild(parent);

      const context = extractNearbyContext(target);
      expect(context).toContain('Previous (<span>): "Previous Item"');
      expect(context).toContain('Next (<span>): "Next Item"');

      document.body.removeChild(parent);
    });
  });

  describe("extractHtmlSnippet", () => {
    it("extracts outerHTML snippet", () => {
      const el = document.createElement("button");
      el.className = "test-btn";
      el.textContent = "Click Me";

      const snippet = extractHtmlSnippet(el);
      expect(snippet).toBe('<button class="test-btn">Click Me</button>');
    });

    it("truncates outerHTML exceeding maxLength", () => {
      const el = document.createElement("p");
      el.textContent = "A".repeat(200);

      const snippet = extractHtmlSnippet(el, 50);
      expect(snippet).toBeDefined();
      expect(snippet?.endsWith("...")).toBe(true);
      expect(snippet?.length).toBe(53);
    });
  });

  describe("buildInspectTargetInfo", () => {
    it("builds a complete target info and payload", () => {
      const button = document.createElement("button");
      button.id = "save-btn";
      button.className = "btn primary";
      button.textContent = "Save Changes";
      document.body.appendChild(button);

      const iframe = document.createElement("iframe");
      iframe.src = "http://localhost:3000/settings";
      document.body.appendChild(iframe);

      const targetInfo = buildInspectTargetInfo(button, iframe);
      expect(targetInfo.tag).toBe("button");
      expect(targetInfo.id).toBe("save-btn");
      expect(targetInfo.className).toBe("btn primary");
      expect(targetInfo.selector).toBe("button#save-btn");
      expect(targetInfo.textContent).toBe("Save Changes");
      expect(targetInfo.textSnippet).toBe("Save Changes");
      expect(targetInfo.payload).toBeDefined();
      expect(targetInfo.payload?.url).toBe("http://localhost:3000/settings");
      expect(targetInfo.payload?.target.tag).toBe("button");

      document.body.removeChild(button);
      document.body.removeChild(iframe);
    });
  });
});
