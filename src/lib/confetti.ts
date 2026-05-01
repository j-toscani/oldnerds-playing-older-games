type Particle = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	color: string;
	size: number;
	rotation: number;
	rotationSpeed: number;
	opacity: number;
};

const COLORS = [
	'#ab6b12', // gold
	'#d4a033', // gold-light
	'#ffdd99', // gold-lighter
	'#0e86ca', // blue
	'#0072ff', // blue-light
	'#66b3ff', // blue-lighter
	'#ffffff',
];

const PARTICLE_COUNT = 120;
const DURATION_MS = 3500;
const GRAVITY = 0.12;
const FRICTION = 0.99;

export function launchConfetti(): void {
	if (typeof window === 'undefined') return;

	const canvas = document.createElement('canvas');
	canvas.style.position = 'fixed';
	canvas.style.top = '0';
	canvas.style.left = '0';
	canvas.style.width = '100vw';
	canvas.style.height = '100vh';
	canvas.style.pointerEvents = 'none';
	canvas.style.zIndex = '9999';
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	document.body.appendChild(canvas);

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		canvas.remove();
		return;
	}

	const particles: Particle[] = [];
	for (let i = 0; i < PARTICLE_COUNT; i++) {
		particles.push({
			x: canvas.width * 0.5 + (Math.random() - 0.5) * canvas.width * 0.4,
			y: canvas.height * 0.3,
			vx: (Math.random() - 0.5) * 12,
			vy: Math.random() * -14 - 4,
			color: COLORS[Math.floor(Math.random() * COLORS.length)],
			size: Math.random() * 6 + 3,
			rotation: Math.random() * Math.PI * 2,
			rotationSpeed: (Math.random() - 0.5) * 0.3,
			opacity: 1,
		});
	}

	const start = performance.now();

	function animate(now: number) {
		const elapsed = now - start;
		const progress = Math.min(elapsed / DURATION_MS, 1);

		ctx!.clearRect(0, 0, canvas.width, canvas.height);

		for (const p of particles) {
			p.x += p.vx;
			p.y += p.vy;
			p.vy += GRAVITY;
			p.vx *= FRICTION;
			p.rotation += p.rotationSpeed;
			p.opacity = 1 - progress;

			ctx!.save();
			ctx!.translate(p.x, p.y);
			ctx!.rotate(p.rotation);
			ctx!.globalAlpha = p.opacity;
			ctx!.fillStyle = p.color;
			ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
			ctx!.restore();
		}

		if (progress < 1) {
			requestAnimationFrame(animate);
		} else {
			canvas.remove();
		}
	}

	requestAnimationFrame(animate);
}
