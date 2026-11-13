import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { authenticatedRequest, authStore, errorMessage, travelPreferenceLabels, type User } from '../auth/auth';
export function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    authenticatedRequest<User>('/users/me').then(value => { if (active) setUser(value); })
      .catch(failure => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!/^\p{L}[\p{L}\p{M} .'-]{0,119}$/u.test(String(data.get('fullName') || '').trim())) {
      setError('Enter a valid name using letters, spaces, apostrophes or hyphens.'); return;
    }
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      const updated = await authenticatedRequest<User>('/users/me', {
        method: 'PATCH', body: JSON.stringify({
          fullName: String(data.get('fullName') ?? '').trim(),
          travelPreference: data.get('travelPreference'),
        }),
      });
      setUser(updated);
      authStore.updateProfile(updated);
      setSaved(true);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return <section className="page narrow"><h1>Your profile.</h1><div className="panel">
    {error && <p role="alert">{error}</p>}
    {user ? <><h2>{user.fullName}</h2><p><a href={`mailto:${user.email}`}>{user.email}</a></p>
      <form className="auth-form" onSubmit={save}>
        <label>Full name<input name="fullName" required maxLength={120} defaultValue={user.fullName} disabled={busy} /></label>
        <label>I want to<select name="travelPreference" defaultValue={user.travelPreference} disabled={busy}>
          {Object.entries(travelPreferenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>
      {saved && <p role="status">Profile saved.</p>}
      <p><Link to="/vehicles">Manage vehicles</Link></p>
    </> : !error && <p role="status">Loading your profile…</p>}
  </div></section>;
}
