import { useState } from "react";
import "./App.css";
import { getStoredUser, clearSession } from "./auth.js";
import { Login } from "./pages/Login.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Products } from "./pages/Products.jsx";
import { Warehouses } from "./pages/Warehouses.jsx";
import { Counterparties } from "./pages/Counterparties.jsx";
import { Users } from "./pages/Users.jsx";
import { Documents } from "./pages/Documents.jsx";
import { initials } from "./utils/format.js";

// Пункты меню зависят от роли — это прямое отражение того, что бэкенд
// вообще разрешает делать каждой роли (Program.cs, RequireRole(...) на
// каждом эндпоинте). Админ не работает со складом изнутри (у него нет
// warehouseId) — ему нужен только список складов и управление пользователями.
// Директор/сотрудник — наоборот, видят "рабочий стол склада" целиком.
// "Пользователи" показываем только Директору — сотрудники создавать
// других пользователей не могут (см. RequireRole("Админ","Директор")
// на /api/users), так что и пункта меню у них нет.
function getNavGroups(role) {
  if (role === "Админ") {
    return [
      {
        title: "СИСТЕМА",
        items: [
          { id: "warehouses", label: "Склады" },
          { id: "users", label: "Пользователи" },
        ],
      },
    ];
  }

  const groups = [
    { title: "РАБОЧИЙ СТОЛ", items: [{ id: "dash", label: "Обзор склада" }] },
    {
      title: "ОПЕРАЦИИ",
      items: [
        { id: "receiving", label: "Приёмка" },
        { id: "shipping", label: "Отгрузка" },
        { id: "count", label: "Инвентаризация" },
      ],
    },
    {
      title: "ЗАПАСЫ",
      items: [
        { id: "products", label: "Номенклатура" },
        // "Контрагенты", а не "Поставщики", как в мокапе: в разделе
        // и поставщики, и покупатели (для отгрузки) — это одна таблица.
        { id: "suppliers", label: "Контрагенты" },
      ],
    },
  ];

  if (role === "Директор") {
    groups.push({ title: "СИСТЕМА", items: [{ id: "users", label: "Пользователи" }] });
  }

  return groups;
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  // Стартовый экран тоже зависит от роли — у Админа нет "Обзора склада",
  // ему просто некуда его показывать (нет своего warehouseId).
  const [screen, setScreen] = useState(() => {
    const user = getStoredUser();
    return user?.role === "Админ" ? "warehouses" : "dash";
  });

  if (!currentUser) {
    return (
      <Login
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setScreen(user.role === "Админ" ? "warehouses" : "dash");
        }}
      />
    );
  }

  function handleLogout() {
    clearSession();
    setCurrentUser(null);
  }

  const navGroups = getNavGroups(currentUser.role);

  return (
    <div className="app-shell">
      {/* Шапка: лого + пользователь. Поиск и колокольчик уведомлений из
          мокапа сюда сознательно не пошли — под ними нет ни одного
          настоящего эндпоинта, показывать нерабочую декорацию не стали. */}
      <header className="app-header">
        <div className="app-header-brand">СКЛАД · WMS</div>
        <div className="app-header-user">
          <div className="app-header-avatar">{initials(currentUser.fullName)}</div>
          <div>
            <div className="app-header-name">{currentUser.fullName}</div>
            <div className="app-header-role">{currentUser.role}</div>
          </div>
        </div>
      </header>

      <div className="app-body">
        <nav className="sidebar">
          {navGroups.map((group) => (
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

          <div className="sidebar-footer">
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </nav>

        <main className="content">
          {/* key={screen} — при смене раздела React видит "другой" элемент
              и монтирует обёртку заново, поэтому анимация .page-enter
              проигрывается на каждом переходе, а не один раз. */}
          <div key={screen} className="page-enter">
            {screen === "dash" && <Dashboard onNavigate={setScreen} />}
            {screen === "products" && <Products />}
            {screen === "receiving" && <Documents typeId={1} kicker="ОПЕРАЦИИ" title="Приёмка товара" createLabel="Создать приёмку" />}
            {screen === "shipping" && <Documents typeId={2} kicker="ОПЕРАЦИИ" title="Отгрузка и заказы" createLabel="Создать отгрузку" />}
            {screen === "count" && <Documents typeId={4} kicker="ОПЕРАЦИИ" title="Инвентаризация" createLabel="Начать пересчёт" />}
            {screen === "suppliers" && <Counterparties />}
            {screen === "warehouses" && <Warehouses />}
            {screen === "users" && <Users role={currentUser.role} currentUserId={currentUser.id} />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
