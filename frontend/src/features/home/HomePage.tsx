import { Link } from 'react-router';

export function HomePage() {
  return <>
    <section className="hero">
      <div><p className="eyebrow">A better way to get there</p>
        <h1>Same direction.<br /><em>Better together.</em></h1>
        <p className="intro">Make room for a shared journey. Hoopr connects drivers and passengers heading the same way.</p>
        <Link className="button" to="/rides">Explore rides <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="journey-art" aria-hidden="true"><div className="route-line" /><span className="route-start">Your city</span><span className="route-end">Somewhere new ↗</span><div className="journey-caption">A little less traffic.<br />A lot more possibility.</div></div>
    </section>
    <section className="steps" aria-label="How Hoopr works">
      <article><span>01 / DISCOVER</span><h2>Find your way</h2><p>Search for rides going where you need to be.</p></article>
      <article><span>02 / CONNECT</span><h2>Share a seat</h2><p>Meet people travelling in the same direction.</p></article>
      <article><span>03 / GO</span><h2>Enjoy the journey</h2><p>Turn your everyday travel into a shared experience.</p></article>
    </section>
  </>;
}
