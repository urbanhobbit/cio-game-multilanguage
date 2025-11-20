import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // AŞAĞIDAKİ KISMI KENDİ REPO ADINLA DEĞİŞTİR
  // Örnek: base: '/cio-game-multilanguage/',
  base: '/cio-game-multilanguage/', 
})