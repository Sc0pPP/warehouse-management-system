import { useState } from "react";
import "./App.css";
import { Products } from "./pages/Products.jsx";
import { References } from "./pages/References.jsx";
import { Warehouses } from "./pages/Warehouses.jsx";
import { Counterparties } from "./pages/Counterparties.jsx";

// Пункты меню, сгруппированные по разделам — как в мокапах (там группы
// "РАБОЧИЙ СТОЛ" / "ОПЕРАЦИИ" / "ЗАПАСЫ" и т.д.). Группируем только то,
// что реально есть — никаких пустых разделов под ещё не built экраны.
const NAV_GROUPS = [
  {
    title: "ЗАПАСЫ",
    items: [
      { id: "products", label: "Номенклатура" },
      { id: "warehouses", label: "Склады" },
      { id: "counterparties", label: "Контрагенты" },
    ],
  },
  {
    title: "СПРАВОЧНИКИ",
    items: [{ id: "references", label: "Справочники" }],
  },
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
        {/* Внешний .map — по группам, внутренний — по пунктам внутри группы.
            Два вложенных .map почти всегда означают "двумерный" список:
            группы содержат массивы, а не сами являются пунктами меню. */}
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="sidebar-group">
            <div className="sidebar-group-title">{group.title}</div>
            {group.items.map((item) => {
              const isActive = screen === item.id;
              const className = `nav-item${isActive ? " nav-item-active" : ""}`;
              return (
                <button key={item.id} className={className} onClick={() => setScreen(item.id)}>
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Правая часть — здесь рисуется тот компонент-страница, который выбран.
          Одновременно показывается только один: остальные условия — false. */}
      <main className="content">
        {screen === "products" && <Products />}
        {screen === "warehouses" && <Warehouses />}
        {screen === "counterparties" && <Counterparties />}
        {screen === "references" && <References />}
      </main>
    </div>
  );
}

export default App;
