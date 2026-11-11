import type { MetadataRoute } from "next";

// "Add to Home Screen" makes Gbam open full-screen like a native app on stage.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gbam",
    short_name: "Gbam",
    description: "Send money like a WhatsApp message.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F9F4",
    theme_color: "#12E26B",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
