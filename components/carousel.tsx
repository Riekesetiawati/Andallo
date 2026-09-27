'use client';

import { useState } from 'react';

export function Carousel({ slides }: { slides: { id: string; title: string; subtitle: string; image_url: string; link: string }[] }) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  if (!slide) return null;
  return (
    <section className="container mt-8" aria-roledescription="carousel">
      <a href={slide.link} className="card grid overflow-hidden md:grid-cols-[1.2fr_1fr]">
        <img src={slide.image_url} alt="" className="h-56 w-full object-cover md:h-72" />
        <div className="grid content-center gap-2 p-6">
          <h2 className="text-3xl">{slide.title}</h2>
          <p className="text-muted">{slide.subtitle}</p>
        </div>
      </a>
      <div className="mt-3 flex gap-2">
        {slides.map((item, itemIndex) => (
          <button key={item.id} type="button" aria-label={`Slide ${itemIndex + 1}`} className={`h-2.5 w-8 rounded-full ${itemIndex === index ? 'bg-pine' : 'bg-line'}`} onClick={() => setIndex(itemIndex)} />
        ))}
      </div>
    </section>
  );
}
