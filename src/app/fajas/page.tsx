
"use client";
// ...existing imports...
import Link from "next/link";

import React, { useState, useEffect, useCallback } from "react";

/* ====== Paleta y helpers ====== */
const GOLD_TEXT_GRADIENT =
  "linear-gradient(135deg,#FFD700 0%,#FFF4BF 45%,#E9C46A 55%,#B8860B 100%)";
const PRIMARY_COLOR = "text-yellow-700"; // Color de acento para enlaces y botones
const CART_COUNT = 3; // Ejemplo de contador

const GoldText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    className="inline-block"
    style={{
      background: GOLD_TEXT_GRADIENT,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))",
    }}
  >
    {children}
  </span>
);

/* ====== Data ====== */
const NAV_ITEMS = ["Inicio", "Comprar", "Nuestra Marca", "Guía de Tallas", "Contacto"];

const CAROUSEL_IMAGES = [
  { 
    id: 1, 
    url: "/images/hero-modelos-1.png", 
    placeholder: "https://placehold.co/1920x1080/e9eaec/2b2b2b?text=Fajas+Vivians",
    alt: "Dos modelos con fajas – portada",
    objectPosition: "center 35%",
  },
  { 
    id: 2, 
    url: "/images/hero-modelos-2.jpg", 
    placeholder: "https://placehold.co/1920x1080/dfdfdf/2b2b2b?text=Coleccion+2025",
    alt: "Colección 2025",
    objectPosition: "center 40%",
  },
  { 
    id: 3, 
    url: "/images/hero-modelos-3.jpg", 
    placeholder: "https://placehold.co/1920x1080/d6d6d6/2b2b2b?text=Confeccion+Colombiana",
    alt: "Confección Colombiana",
    objectPosition: "center 45%",
  },
];

/* ====== Hero Carousel (Fondo Dinámico + Contenido Estático/Dividido con Efecto Fundido) ====== */
const HeroCarousel: React.FC = () => {
  const [active, setActive] = useState(0);

  const next = useCallback(
    () => setActive((i) => (i === CAROUSEL_IMAGES.length - 1 ? 0 : i + 1)),
    []
  );
  const prev = () =>
    setActive((i) => (i === 0 ? CAROUSEL_IMAGES.length - 1 : i - 1));

  useEffect(() => {
    const t = setInterval(next, 8000);
    return () => clearInterval(t);
  }, [next]);

  return (
    <div className="relative w-full h-[78vh] min-h-[520px] overflow-hidden">
      {/* CAPA 0: Fondo base (se ve a través de zonas transparentes de las imágenes) */}
      <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700" />

      {/* CAPA 1: Fondo Dinámico (Carrusel con transición de Opacidad) */}
      <div className="absolute inset-0">
        {CAROUSEL_IMAGES.map((item, index) => (
          <div 
            key={item.id} 
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === active ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={item.url}
              alt={item.alt}
              style={{ background: "transparent", display: "block", objectPosition: item.objectPosition }}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* CAPA 2: Contenido Estático (Overlay con gradiente de división) */}
      <div className="relative z-10 h-full w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        <div className="h-full max-w-7xl mx-auto px-6 md:px-8 flex items-center">
          <div className="max-w-xl">
            <h1 className="text-white font-black uppercase tracking-wider drop-shadow-lg text-4xl sm:text-5xl lg:text-6xl">
              FAJAS <GoldText>VIVIANS</GoldText>
            </h1>
            <p className="mt-3 text-white/90 text-lg sm:text-xl">
              El Secreto de tu Silueta Perfecta.
            </p>
            <Link
              href="#coleccion"
              className="mt-8 inline-block rounded-md px-8 py-3 text-gray-900 font-semibold uppercase shadow-lg transition hover:scale-[1.03]"
              style={{
                background: GOLD_TEXT_GRADIENT,
              }}
            >
              Explorar Colección
            </Link>
          </div>
        </div>
      </div>

      {/* Flechas */}
      <button
        onClick={prev}
        aria-label="Anterior"
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={next}
        aria-label="Siguiente"
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Puntos verticales */}
      <div className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col gap-3 z-20">
        {CAROUSEL_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            aria-label={`Ir al slide ${i + 1}`}
            className={`h-2 w-2 rounded-full transition-all ${
              i === active
                ? "bg-yellow-500 ring-2 ring-white"
                : "bg-white/60 hover:bg-white"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

/* ====== Página ====== */
const FajasViviansPage: React.FC = () => {
  const CATEGORIES = [
    {
      title: "Post-Quirúrgica",
      description: "Recouración & Resultaas", // replicado tal cual la captura
      image: "/images/faja-post-quirurgica.jpg",
    },
    {
      title: "Uso Diario",
      description: "Comodidad Invisible",
      image: "/images/faja-uso-diario.jpg",
    },
    {
      title: "Top Sellers",
      description: "Nuestras Favoritas",
      image: "/images/faja-top-sellers.jpg",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 antialiased">
      {/* Header negro */}
      <header className="fixed top-0 inset-x-0 z-30 bg-black">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          {/* Logo con fondo transparente y cover */}
          <Link href="/" className="flex items-center">
            <div className="h-12 sm:h-14 w-[160px] sm:w-[180px] overflow-hidden">
              <img 
                src="/images/vivians-logo.png"
                alt="FAJAS VIVIANS Logo"
                className="h-full w-full object-cover"   // ⬅️ adapta al fondo
                style={{ background: "transparent", display: "block" }}
              />
            </div>
          </Link>

          {/* Menú */}
          <nav className="hidden md:flex items-center gap-7">
            {NAV_ITEMS.map((item, idx) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s/g, "-")}`}
                className={`relative text-sm ${
                  idx === 0 ? "text-white" : "text-white/80"
                } hover:text-white transition group`}
              >
                {item}
                <span
                  className={`absolute left-0 -bottom-1 h-[2px] bg-yellow-500 transition-all duration-300 ${
                    idx === 0 ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </a>
            ))}
          </nav>

          {/* Iconos */}
          <div className="flex items-center gap-4 text-white">
            <button aria-label="Buscar" className="opacity-90 hover:opacity-100">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button aria-label="Carrito" className="relative opacity-90 hover:opacity-100">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4m-8 2a2 2 0 11-4 0 2 2 0 014 0" />
              </svg>
              <span className="absolute -top-2 -right-2 rounded-full bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5">
                {CART_COUNT}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="hero" className="pt-20"> 
        <HeroCarousel />
      </section>

      {/* Categorías (título exactamente como en la captura) */}
      <section
        id="coleccion"
        className="-mt-10 md:-mt-20 relative z-10 max-w-7xl mx-auto px-6 md:px-8 py-16 bg-white rounded-xl shadow-xl"
      >
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-10">
          Categorías Destariadas
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          {CATEGORIES.map((c) => (
            <div
              key={c.title}
              className="rounded-lg border border-gray-200 bg-white p-4 transition hover:shadow-lg"
            >
              <div className="mb-4 overflow-hidden rounded-md bg-gray-100">
                <img
                  src={c.image}
                  onError={(e) => {
                      e.currentTarget.src = "https://placehold.co/420x520/f6f6f6/2b2b2b?text=Producto";
                  }}
                  alt={c.title}
                  className="w-full h-[280px] object-cover"  // ⬅️ llena y adapta
                  style={{ background: "transparent", display: "block" }}
                />
              </div>
              <h3 className="text-lg font-bold">{c.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{c.description}</p>
              <a
                href="#"
                className={`text-sm font-semibold ${PRIMARY_COLOR} hover:text-yellow-800`}
              >
                Ver Más
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Beneficios */}
      <section id="beneficios" className="bg-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-12">
            La Diferencia <GoldText>VIVIANS</GoldText>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
              <h3 className={`text-xl font-bold ${PRIMARY_COLOR} mb-2`}>
                Tecnología de Compresión
              </h3>
              <p className="text-gray-700">
                Telas de última generación con compresión graduada para un moldeo
                efectivo y seguro.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
              <h3 className={`text-xl font-bold ${PRIMARY_COLOR} mb-2`}>
                Confección Colombiana
              </h3>
              <p className="text-gray-700">
                100% fabricadas en Colombia: máxima calidad y durabilidad.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
              <h3 className={`text-xl font-bold ${PRIMARY_COLOR} mb-2`}>
                Guía de Tallas Perfecta
              </h3>
              <p className="text-gray-700">
                Asesoría personalizada para encontrar tu talla ideal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer negro */}
      <footer className="bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-10 text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} FAJAS VIVIANS. Todos los derechos reservados.
          </p>
          <div className="mt-4 space-x-6">
            <a className="text-gray-400 hover:text-white text-sm" href="#">
              Política de Privacidad
            </a>
            <a className="text-gray-400 hover:text-white text-sm" href="#">
              Términos y Condiciones
            </a>
            <a className="text-gray-400 hover:text-white text-sm" href="#">
              Preguntas Frecuentes
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FajasViviansPage;
