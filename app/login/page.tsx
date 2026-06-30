'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Manager {
  id: string;
  name: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'admin' | 'manager'>('manager');
  const [managers, setManagers] = useState<Manager[]>([]);
  const [managerId, setManagerId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/managers')
      .then((r) => r.json())
      .then((data: Manager[]) => {
        if (Array.isArray(data)) {
          setManagers(data);
          if (data.length > 0) setManagerId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body =
        tab === 'admin'
          ? { role: 'admin', password }
          : { role: 'manager', password, managerId };

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Ошибка входа');
        return;
      }

      router.push(tab === 'admin' ? '/admin' : '/call');
      router.refresh();
    } catch {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="login-title">Kaspi Calling</div>
        <div className="login-subtitle">Система управления звонками</div>

        <div className="tab-row">
          <button
            className={`tab-btn ${tab === 'manager' ? 'active' : ''}`}
            onClick={() => {
              setTab('manager');
              setError('');
            }}
          >
            Менеджер
          </button>
          <button
            className={`tab-btn ${tab === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setTab('admin');
              setError('');
            }}
          >
            Админ
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {tab === 'manager' && (
            <div className="form-group">
              <label>Выберите менеджера</label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                required
              >
                {managers.length === 0 && (
                  <option value="">Нет менеджеров</option>
                )}
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === 'admin' ? 'Пароль администратора' : 'Пароль менеджера'}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            type="submit"
            className="btn-green"
            style={{ width: '100%', marginTop: '16px', padding: '12px' }}
            disabled={loading || (tab === 'manager' && !managerId)}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
