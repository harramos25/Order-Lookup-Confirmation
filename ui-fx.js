document.addEventListener('DOMContentLoaded', () => {
    initEntranceAnimations();
    initTiltEffect();
});

function initEntranceAnimations() {
    // Kunin muna yung mga main elements
    const mainCard = document.querySelector('.glass-panel');
    const header = document.querySelector('header');
    const footer = document.querySelector('footer'); // If exists

    // Lagyan natin ng staggered delays para smooth tignan
    if (header) {
        header.style.opacity = '0';
        header.style.animation = 'waterfallFade 0.8s ease-out forwards 0.2s';
    }

    if (mainCard) {
        mainCard.style.opacity = '0';
        mainCard.style.animation = 'materializeUp 1s ease-out forwards 0.5s';

        // Pasunod-sunurin natin yung mga children para maganda entrance
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

    // Gawin nating 3D style yung container para astig
    card.style.transformStyle = 'preserve-3d';
    card.style.transition = 'transform 0.1s ease-out'; // Para hindi bigla yung movement

    document.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;

        // Compute muna natin yung center position (-1 to 1)
        const x = (clientX - innerWidth / 2) / (innerWidth / 2);
        const y = (clientY - innerHeight / 2) / (innerHeight / 2);

        // Ito yung max rotation, 5 degrees para subtle lang
        const maxRot = 5;
        // Baliktarin yung X/Y para natural yung tilt
        const rotateX = -y * maxRot;
        const rotateY = x * maxRot;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    // Balik natin sa dati pag umalis na yung mouse
    document.addEventListener('mouseleave', () => {
        card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
    });
}
