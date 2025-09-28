export default function App() {
  const gallery = [
    { title: "Park run", src: "/images/hachito1.png", alt: "Hacheeto running in the park" },
    { title: "Cozy nap", src: "/images/hachito2.png", alt: "Hacheeto cozy nap" },
    { title: "Play ball", src: "/images/hachito3.png", alt: "Hacheeto playing with ball" },
    { title: "Brave bark", src: "/images/hachito4.png", alt: "Hacheeto barking at cat" },
    { title: "Silly jacket", src: "/images/hachito5.png", alt: "Hacheeto with silly jacket" },
    { title: "Rocket ride", src: "/images/hachito6.png", alt: "Hacheeto rocket adventure" },
  ];

  return (
    <div>
      <h1>Welcome to Hacheeto!</h1>
      <a href="/downloads/Hacheeto_Big_Adventure_PrintReady.pdf">Download Storybook</a>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
        {gallery.map((g, idx) => (
          <figure key={idx}>
            <img src={g.src} alt={g.alt} style={{width:"100%"}}/>
            <figcaption>{g.title}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
