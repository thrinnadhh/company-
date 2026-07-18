import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CompanyNow",
    short_name: "CompanyNow",
    description: "Someone nearby. A moment together.",
    start_url: "/",
    display: "standalone",
    background_color: "#030807",
    theme_color: "#07110f",
    icons: [
      {
        src: "/companynow-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
