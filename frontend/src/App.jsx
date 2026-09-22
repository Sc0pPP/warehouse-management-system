import { useState } from "react";
import "./App.css";
import { getStoredUser, clearSession } from "./auth.js";
import { Login } from "./pages/Login.jsx";
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
  // useState(() => getStoredUser()) — функция вместо готового значения.
  // React вызовет её только ОДИН раз, при самом первом рендере компонента.
  // Если написать просто useState(getStoredUser()) — getStoredUser()
  // вызывался бы на КАЖДОМ рендере (хоть и использовался бы только
  // первый результат) — лишнее чтение localStorage без всякой пользы.
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [screen, setScreen] = useState("products");

  // Пока не залогинены — вообще не показываем сайдбар и страницы,
  // только форму входа. onLoginSuccess === setCurrentUser: как только
  // Login.jsx получит пользователя от сервера, он попадёт прямо в state.
  if (!currentUser) {
    return <Login onLoginSuccess={setCurrentUser} />;
  }

  function handleLogout() {
    clearSession();
    setCurrentUser(null);
  }

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

        {/* marginTop: "auto" внутри flex-column-контейнера прижимает этот
            блок к самому низу сайдбара, сколько бы места ни осталось. */}
        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--color-divider)" }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{currentUser.fullName}</div>
          <div className="text-muted" style={{ fontSize: 11, marginBottom: 8 }}>{currentUser.role}</div>
          <button className="btn btn-secondary" style={{ width: "100%" }} onClick={handleLogout}>
            Выйти
          </button>
        </div>
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
