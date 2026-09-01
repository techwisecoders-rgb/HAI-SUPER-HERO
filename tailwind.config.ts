import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Cyan accents from the original are exposed as Tailwind colors.
      colors: {
        cyan: { 400: "#00e5ff", 500: "#00bcd4", 600: "#00a7bd" },
      },
    },
  },
  plugins: [],
};
export default config;
