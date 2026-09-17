import { useState } from "react";
import { Products } from "./pages/Products.jsx";
import { References } from "./pages/References.jsx";
import { Warehouses } from "./pages/Warehouses.jsx";

// Список пунктов меню слева: id — внутреннее имя экрана (используем в коде),
// label — то, что видит пользователь на кнопке.
const NAV_ITEMS = [
  { id: "products", label: "Номенклатура" },
  { id: "warehouses", label: "Склады" },
  { id: "references", label: "Справочники" },
];

function App() {
  // Какой экран сейчас открыт. Меняется по клику на пункт меню —
  // это единственное, что связывает сайдбар с содержимым справа.
  const [screen, setScreen] = useState("products");

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif" }}>
      {/* Левая колонка — навигация */}
      <nav style={{ width: 200, flexShrink: 0, borderRight: "1px solid #ccc", padding: 16 }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: 8,
              marginBottom: 4,
              border: "none",
              cursor: "pointer",
              // Подсвечиваем кнопку текущего экрана — сравниваем её id с тем,
              // что сейчас лежит в state screen.
              background: screen === item.id ? "#e0e0e0" : "transparent",
              fontWeight: screen === item.id ? 600 : 400,
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Правая часть — здесь рисуется тот компонент-страница, который выбран.
          Одновременно показывается только один: остальные условия — false. */}
      <main style={{ flex: 1, padding: 24 }}>
        {screen === "products" && <Products />}
        {screen === "warehouses" && <Warehouses />}
        {screen === "references" && <References />}
      </main>
    </div>
  );
}

export default App;
