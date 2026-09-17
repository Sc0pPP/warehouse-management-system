import { useState } from "react";
import "./App.css";
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
    <div className="app-shell">
      {/* Левая колонка — навигация */}
      <nav className="sidebar">
        <div className="sidebar-brand">СКЛАД · WMS</div>
        {NAV_ITEMS.map((item) => {
          const isActive = screen === item.id;
          // Собираем строку классов вручную: базовый класс всегда есть,
          // класс "активности" добавляется только для текущего экрана.
          // Шаблонная строка с условием (isActive ? "..." : "") —
          // самый простой способ сделать это без отдельной библиотеки.
          const className = `nav-item${isActive ? " nav-item-active" : ""}`;
          return (
            <button key={item.id} className={className} onClick={() => setScreen(item.id)}>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Правая часть — здесь рисуется тот компонент-страница, который выбран.
          Одновременно показывается только один: остальные условия — false. */}
      <main className="content">
        {screen === "products" && <Products />}
        {screen === "warehouses" && <Warehouses />}
        {screen === "references" && <References />}
      </main>
    </div>
  );
}

export default App;
