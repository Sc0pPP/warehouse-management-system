import { useEffect, useState } from "react";

const API_BASE = "http://localhost:5034/api";

// Страница "Справочники" — четыре маленьких списка (роли, типы контрагентов,
// типы документов, категории). Ничего не редактируем, только читаем.
export function References() {
  const [roles, setRoles] = useState([]);
  const [counterpartyTypes, setCounterpartyTypes] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadReferences() {
      try {
        // Promise.all отправляет все 4 запроса СРАЗУ, параллельно, а не по очереди —
        // ждём столько же, сколько заняла бы самая медленная из четырёх, а не сумму всех.
        const [rolesRes, typesRes, docTypesRes, categoriesRes] = await Promise.all([
          fetch(`${API_BASE}/roles`),
          fetch(`${API_BASE}/counterparty-types`),
          fetch(`${API_BASE}/document-types`),
          fetch(`${API_BASE}/categories`),
        ]);
        if (!rolesRes.ok || !typesRes.ok || !docTypesRes.ok || !categoriesRes.ok) {
          throw new Error("Ошибка сервера при загрузке справочников");
        }
        setRoles(await rolesRes.json());
        setCounterpartyTypes(await typesRes.json());
        setDocumentTypes(await docTypesRes.json());
        setCategories(await categoriesRes.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadReferences();
  }, []);

  return (
    <div>
      <h2>Справочники</h2>
      {error && <p style={{ color: "red" }}>Ошибка: {error}</p>}
      {loading && !error && <p>Загрузка...</p>}
      {!loading && !error && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <h3>Роли</h3>
            <ul>
              {roles.map((r) => (
                <li key={r.id}>{r.name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Типы контрагентов</h3>
            <ul>
              {counterpartyTypes.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Типы документов</h3>
            <ul>
              {documentTypes.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Категории</h3>
            <ul>
              {categories.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
