import React, { useState } from "react";
import { createRoot } from "react-dom/client";
window.submits = 0;
window.__piWebUiHost = {
  version: 11,
  dom: {
    anchors: () => ({
      composer: document.querySelector('[data-pi-anchor="composer"]'),
    }),
  },
  onViewChange: () => () => {},
};
function App() {
  const [text, setText] = useState("");
  return (
    <>
      <div data-pi-anchor="composer">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              window.submits++;
            }
          }}
        />
        <output>{text}</output>
      </div>
      <textarea id="other" />
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
import("/pi/plugins/skill-mention/client/entry.mjs");
