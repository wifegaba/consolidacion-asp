'use client';

import React from 'react';

export const DisplacementFilters = () => {
    return (
        <svg className="fixed w-0 h-0 pointer-events-none" aria-hidden="true">
            <defs>
                {/* Filtro de Refracción Líquida */}
                <filter id="liquid-refraction" x="-20%" y="-20%" width="140%" height="140%">
                    {/* Generación de Ruido Perlin para la textura */}
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.005 0.02"
                        numOctaves="3"
                        result="noise"
                    />
                    {/* Mapa de Desplazamiento usando el ruido */}
                    <feDisplacementMap
                        in="SourceGraphic"
                        in2="noise"
                        scale="15"
                        xChannelSelector="R"
                        yChannelSelector="G"
                    />
                    {/* Composición para suavizar bordes */}
                    <feComposite operator="in" in2="SourceGraphic" />
                </filter>

                {/* Filtro de "Hielo" para botones o bordes */}
                <filter id="frost-effect">
                    <feTurbulence type="turbulence" baseFrequency="0.2" numOctaves="2" result="turbulence" />
                    <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="2" xChannelSelector="R" yChannelSelector="G" />
                </filter>
            </defs>
        </svg>
    );
};




















