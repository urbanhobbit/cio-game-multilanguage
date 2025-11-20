import React from "react";
import ReactDOM from "react-dom/client";
import FullGame from "./components/FullGame.jsx"; // <-- App yerine bunu import ediyoruz
import './i18n'; // Dil ayarlarını yüklüyoruz

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <FullGame />
  </React.StrictMode>
);