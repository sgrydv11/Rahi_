import { useEffect, useState } from 'react';
import { authenticatedRequest, errorMessage, travelPreferenceLabels, type User } from '../auth/auth';
export function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    authenticatedRequest<User>('/users/me').then(value => { if (active) setUser(value); })
      .catch(failure => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, []);
  return <section className="page narrow"><h1>Your profile.</h1><div className="panel">
    {error ? <p role="alert">{error}</p> : user ? <><h2>{user.fullName}</h2><p>{user.email}</p>
      <p>I want to: {travelPreferenceLabels[user.travelPreference]}</p><p>Role: {user.role}</p></> : <p role="status">Loading your profile…</p>}
  </div></section>;
}
