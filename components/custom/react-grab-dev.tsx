"use client";

import { useEffect } from "react";

export function ReactGrabDev() {
  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-react-grab-loader="true"]',
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://unpkg.com/react-grab/dist/index.global.js";
    script.crossOrigin = "anonymous";
    script.dataset.reactGrabLoader = "true";
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}
