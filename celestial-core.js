/**
 * celestial-core.js
 * Shared UI effects and animations for the Sanctuary application.
 */

export let isWarping = true;

export function setWarping(state) {
    isWarping = state;
}

/**
 * Updates the 'stardate' in all relevant containers
 */
export function initStardate() {
    const containers = document.querySelectorAll('.font-headline');
    
    const updateStardate = () => {
        const now = new Date();
        const year = now.getUTCFullYear();
        const dayOfYear = Math.floor((now - new Date(year, 0, 0)) / (1000 * 60 * 60 * 24));
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const stardate = `${year}${dayOfYear}.${hours}${minutes}`;
        
        containers.forEach(el => {
            if (el.textContent.includes('stardate')) {
                const baseText = el.id === 'app-header' ? "captain's log" : el.textContent.split(' stardate')[0];
                el.innerHTML = `${baseText} <span id="header-stardate" class="text-primary/80 opacity-90 inline-block ml-1">stardate ${stardate}</span>`;
            }
        });
    };
    
    updateStardate();
    setInterval(updateStardate, 60000);
}

/**
 * Animated Starfield Background
 */
export function initStarfield() {
    const canvas = document.getElementById('space-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let stars = [];
    const starCount = 200;
    let width, height, centerX, centerY;

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        centerX = width / 2;
        centerY = height / 2;
    }

    class Star {
        constructor() { this.init(); }
        init() {
            const spread = 0.2;
            this.x = (Math.random() - 0.5) * (width * spread);
            this.y = (Math.random() - 0.5) * (height * spread);
            this.z = Math.random() * width;
            this.px = 0; this.py = 0;
            this.size = Math.random() * 1.5;
            this.color = Math.random() > 0.8 ? '#CCBEFF' : '#FFFFFF';
        }
        update() {
            this.px = this.screenX; this.py = this.screenY;
            if (isWarping) { this.z -= 15; }
            if (this.z <= 0) {
                this.init(); this.z = width;
                this.px = this.screenX; this.py = this.screenY;
            }
            this.screenX = (this.x / this.z) * width + centerX;
            this.screenY = (this.y / this.z) * height + centerY;
            if (this.screenX < 0 || this.screenX > width || this.screenY < 0 || this.screenY > height) { this.init(); }
        }
        draw() {
            if (this.px === 0 || !this.screenX) return;
            ctx.beginPath();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = (1 - this.z / width) * this.size * 2;
            ctx.lineCap = 'round';
            ctx.globalAlpha = Math.min(1.5 - this.z / width, 0.8);
            ctx.moveTo(this.px, this.py);
            ctx.lineTo(this.screenX, this.screenY);
            ctx.stroke();
        }
    }

    function animate() {
        ctx.fillStyle = 'rgba(22, 16, 33, 0.15)'; 
        ctx.fillRect(0, 0, width, height);
        stars.forEach(star => { star.update(); star.draw(); });
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    resize();
    for (let i = 0; i < starCount; i++) { stars.push(new Star()); }
    animate();
}

/**
 * Smooth entrance animation for the main UI card
 */
export function initSilkRise() {
    const mainCard = document.querySelector('main > div') || document.querySelector('main');
    if (mainCard) {
        mainCard.style.opacity = '0';
        mainCard.style.transform = 'translateY(40px) scale(0.98)';
        mainCard.style.transition = 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)';
        setTimeout(() => {
            mainCard.style.opacity = '1';
            mainCard.style.transform = 'translateY(0) scale(1)';
        }, 300);
    }
}

/**
 * Mouse-driven parallax
 */
export function initParallax() {
    const layers = document.querySelectorAll('[data-parallax]');
    document.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        layers.forEach(layer => {
            const speed = parseFloat(layer.getAttribute('data-parallax')) || 0.05;
            const x = (centerX - clientX) * speed;
            const y = (centerY - clientY) * speed;
            layer.style.transform = `translate(${x}px, ${y}px)`;
            layer.style.transition = 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
        });
    });
}

/**
 * Atmospheric cursor glow
 */
export function initCursorGlow() {
    const glow = document.getElementById('cursor-glow');
    if (!glow) return;
    document.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;
        if (glow.style.opacity === '0' || glow.style.opacity === '') { glow.style.opacity = '1'; }
        glow.style.left = `${clientX}px`;
        glow.style.top = `${clientY}px`;
    });
}
