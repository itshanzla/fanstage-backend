"use client";

import { useEffect } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function DocsPage() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    const prevRootBg = root.style.getPropertyValue("--background");
    const prevRootFg = root.style.getPropertyValue("--foreground");
    const prevBodyBg = body.style.background;
    const prevBodyColor = body.style.color;

    root.style.setProperty("--background", "#ffffff");
    root.style.setProperty("--foreground", "#171717");
    body.style.background = "#ffffff";
    body.style.color = "#171717";

    return () => {
      if (prevRootBg) {
        root.style.setProperty("--background", prevRootBg);
      } else {
        root.style.removeProperty("--background");
      }

      if (prevRootFg) {
        root.style.setProperty("--foreground", prevRootFg);
      } else {
        root.style.removeProperty("--foreground");
      }

      body.style.background = prevBodyBg;
      body.style.color = prevBodyColor;
    };
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#ffffff", color: "#171717" }}>
      <SwaggerUI url="/openapi.json" />
    </main>
  );
}
