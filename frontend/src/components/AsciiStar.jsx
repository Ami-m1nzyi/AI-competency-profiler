import still from '../assets/moodboard/ascii-star.png';
import motion from '../assets/moodboard/ascii-star.mp4';
export default function AsciiStar({className = '', animated = false}) {
 return <div className={`${className} ${animated ? 'ascii-star-animated' : ''}`} style={{background: 'var(--background)'}} aria-hidden="true">
  <img className={`ascii-star ${animated ? 'ascii-star-still' : ''}`} src={still} alt="" />
  {animated && <video className="ascii-star ascii-star-video" src={motion} autoPlay muted loop playsInline preload="metadata" tabIndex={-1} />}
 </div>;
}