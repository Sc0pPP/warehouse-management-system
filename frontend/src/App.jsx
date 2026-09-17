import { useEffect, useState } from "react";

// Пока просто константа. Позже, когда появится .env, заменим на import.meta.env.VITE_API_BASE
const API_BASE = "http://localhost:5034/api";

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${API_BASE}/products`);
        if (!response.ok) {
          throw new Error(`Ошибка сервера: ${response.status}`);
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      }
    }

    load();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Проверка связи с бэкендом</h1>
      <p>Запрос: GET {API_BASE}/products</p>

      {error && <p style={{ color: "red" }}>Ошибка: {error}</p>}
      {!error && !data && <p>Загрузка...</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}

export default App;
