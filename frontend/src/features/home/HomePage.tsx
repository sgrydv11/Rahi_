import {useAuth} from '../auth/AuthContext';
import {canOffer,canBook} from '../auth/capabilities';
import {Icon} from '../../app/Icon';
import { Link } from 'react-router';

export function HomePage() {
  const{user}=useAuth();
  return <>
    <section className="hero">
      <div><p className="eyebrow">A better way to get there</p>
        <h1>Same direction.<br /><em>Better together.</em></h1>
        <p className="intro">Make room for a shared journey. FlexirRides connects drivers and passengers heading the same way.</p>
        <div className="ride-actions">{canBook(user)&&<Link className="button" to="/rides">Explore rides <Icon name="arrow-forward-outline"/></Link>}{canOffer(user)&&<Link className="button" to="/rides/new">Offer a ride <Icon name="add-outline"/></Link>}</div>
      </div>
    </section>
    <section className="steps" aria-label="How FlexirRides works">
      <article><span>01 / DISCOVER</span><h2>Find your way</h2><p>Search for rides going where you need to be.</p></article>
      <article><span>02 / CONNECT</span><h2>Share a seat</h2><p>Meet people travelling in the same direction.</p></article>
      <article><span>03 / GO</span><h2>Enjoy the journey</h2><p>Turn your everyday travel into a shared experience.</p></article>
    </section>
  </>;
}
