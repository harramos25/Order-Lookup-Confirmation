/**
 * UI FX: Cosmic Interactions
 * Handles 3D Tilt and Cinematic Entrances
 */

document.addEventListener('DOMContentLoaded', () => {
    initEntranceAnimations();
    initTiltEffect();
});

function initEntranceAnimations() {
    // Select main elements
    const mainCard = document.querySelector('.glass-panel');
    const header = document.querySelector('header');
    const footer = document.querySelector('footer'); // If exists

    // Apply staggered delays
    if (header) {
        header.style.opacity = '0';
        header.style.animation = 'waterfallFade 0.8s ease-out forwards 0.2s';
    }

    if (mainCard) {
        mainCard.style.opacity = '0';
        mainCard.style.animation = 'materializeUp 1s ease-out forwards 0.5s';

        // Stagger internal children
        const children = mainCard.querySelectorAll('h2, .input-group, button, .preview-details > div');
        children.forEach((child, index) => {
            child.style.opacity = '0';
            child.style.animation = `waterfallFade 0.6s ease-out forwards ${0.8 + (index * 0.1)}s`;
        });
    }
}

function initTiltEffect() {
    const card = document.querySelector('.glass-panel');
    if (!card) return;

    // Add 3D container style wrapper if needed, or apply directly
    card.style.transformStyle = 'preserve-3d';
    card.style.transition = 'transform 0.1s ease-out'; // Smooth follow

    document.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;

        // Calculate center relative position (-1 to 1)
        const x = (clientX - innerWidth / 2) / (innerWidth / 2);
        const y = (clientY - innerHeight / 2) / (innerHeight / 2);

        // Max rotation degrees
        const maxRot = 5;
        // Invert X/Y for natural tilt feeling
        const rotateX = -y * maxRot;
        const rotateY = x * maxRot;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    // Reset on leave (optional)
    document.addEventListener('mouseleave', () => {
        card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
    });
}
