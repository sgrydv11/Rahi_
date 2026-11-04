import { Link } from 'react-router';
export function NotFoundPage() {
  return <section className="page"><p className="eyebrow">404</p><h1>A little off route.</h1><p>This page could not be found.</p><Link className="button" to="/">Back to home</Link></section>;
}
