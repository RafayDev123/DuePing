import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DuePing",
    short_name: "DuePing",
    description: "Invoice tracking, payment records and respectful reminders.",
    start_url: "/app",
    display: "standalone",
    background_color: "#F5F4EF",
    theme_color: "#236B57",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
