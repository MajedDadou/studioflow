import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        studio: {
          orange: "#d1571b",
          orangeDark: "#a94315",
          ink: "#1f2933",
          paper: "#fbf7f2",
          line: "#e7ded6"
        }
      },
      boxShadow: {
        soft: "0 18px 60px rgba(31, 41, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
