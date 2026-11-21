import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        maple: "#D26B42",
        cocoa: "#3E2319",
        cream: "#F9F6F0",
        oat: "#E9E0D3",
        sage: "#71816C",
      },
      fontFamily: { sans: ["var(--font-geist-sans)", "sans-serif"] },
    },
  },
  plugins: [],
};

export default config;
