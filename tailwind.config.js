/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'custom-beige-bg': '#F5F1E9', // <-- 이 색을 새로 추가했습니다.
      },
      backgroundImage: {
        'custom-background': "url('/public/background.jpg')",
      },
    },
  },
  plugins: [],
}