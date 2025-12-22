"use client";

import React from "react";
import confetti from "canvas-confetti";

export interface ConfettiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    confettiOptions?: confetti.Options;
}

export function ConfettiButton({
    children,
    onClick,
    confettiOptions,
    ...props
}: ConfettiButtonProps) {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Trigger confetti BEFORE calling the onClick handler
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;

        confetti({
            particleCount: 100,
            spread: 70,
            origin: { x, y },
            ...confettiOptions,
        });

        // Then call the original onClick
        if (onClick) {
            onClick(e);
        }
    };

    return (
        <button {...props} onClick={handleClick}>
            {children}
        </button>
    );
}
