import { useEffect, useRef } from 'react';

type Star = {
  x: number;
  y: number;
  z: number;
  speed: number;
  size: number;
  hue: number;
};

type Spark = {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  phase: number;
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createStar(): Star {
  return {
    x: randomBetween(-1, 1),
    y: randomBetween(-1, 1),
    z: randomBetween(0.08, 1),
    speed: randomBetween(0.0018, 0.0062),
    size: randomBetween(0.55, 2.2),
    hue: randomBetween(188, 318),
  };
}

function createSpark(index: number): Spark {
  return {
    angle: index * 0.36 + randomBetween(-0.2, 0.2),
    radius: randomBetween(0.05, 0.46),
    speed: randomBetween(0.0007, 0.0028),
    size: randomBetween(0.8, 2.8),
    phase: randomBetween(0, Math.PI * 2),
  };
}

function getParticleBudget() {
  const isCompactViewport = window.innerWidth < 768 || window.innerHeight < 680;
  return {
    maxDpr: isCompactViewport ? 1.15 : 1.5,
    stars: isCompactViewport ? 86 : 148,
    sparks: isCompactViewport ? 34 : 58,
  };
}

export function TitleSpaceBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;

    const canvasElement = canvas;
    const ctx = context;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let particleBudget = getParticleBudget();
    const stars = Array.from({ length: particleBudget.stars }, createStar);
    const sparks = Array.from({ length: particleBudget.sparks }, (_, index) => createSpark(index));
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let animationFrame = 0;
    let isVisible = !document.hidden;
    let width = 0;
    let height = 0;
    let dpr = 1;

    function resizeCanvas() {
      particleBudget = getParticleBudget();
      dpr = Math.min(window.devicePixelRatio || 1, particleBudget.maxDpr);
      width = window.innerWidth;
      height = window.innerHeight;
      canvasElement.width = Math.floor(width * dpr);
      canvasElement.height = Math.floor(height * dpr);
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawNebula(time: number) {
      const centerX = width * (0.58 + pointer.x * 0.018);
      const centerY = height * (0.38 + pointer.y * 0.018);

      const background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, '#020312');
      background.addColorStop(0.38, '#080921');
      background.addColorStop(0.72, '#101233');
      background.addColorStop(1, '#02050c');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      const tealCloud = ctx.createRadialGradient(centerX - width * 0.22, centerY, 0, centerX - width * 0.22, centerY, width * 0.48);
      tealCloud.addColorStop(0, 'rgba(47, 226, 255, 0.24)');
      tealCloud.addColorStop(0.42, 'rgba(31, 115, 255, 0.12)');
      tealCloud.addColorStop(1, 'rgba(2, 3, 18, 0)');
      ctx.fillStyle = tealCloud;
      ctx.fillRect(0, 0, width, height);

      const magentaCloud = ctx.createRadialGradient(centerX + width * 0.12, centerY - height * 0.08, 0, centerX + width * 0.12, centerY - height * 0.08, width * 0.42);
      magentaCloud.addColorStop(0, 'rgba(244, 75, 255, 0.2)');
      magentaCloud.addColorStop(0.46, 'rgba(122, 79, 255, 0.13)');
      magentaCloud.addColorStop(1, 'rgba(2, 3, 18, 0)');
      ctx.fillStyle = magentaCloud;
      ctx.fillRect(0, 0, width, height);

      const riftGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width * 0.28);
      riftGlow.addColorStop(0, `rgba(255, 255, 255, ${0.3 + Math.sin(time * 0.0012) * 0.06})`);
      riftGlow.addColorStop(0.1, 'rgba(126, 245, 255, 0.28)');
      riftGlow.addColorStop(0.28, 'rgba(187, 91, 255, 0.18)');
      riftGlow.addColorStop(1, 'rgba(2, 3, 18, 0)');
      ctx.fillStyle = riftGlow;
      ctx.fillRect(0, 0, width, height);
    }

    function drawStars(time: number) {
      const centerX = width * (0.58 + pointer.x * 0.04);
      const centerY = height * (0.4 + pointer.y * 0.04);
      const depth = Math.max(width, height) * 0.86;

      for (const star of stars) {
        star.z -= reducedMotion ? 0 : star.speed;
        if (star.z <= 0.02) {
          Object.assign(star, createStar());
          star.z = 1;
        }

        const perspective = 1 / star.z;
        const x = centerX + star.x * depth * perspective;
        const y = centerY + star.y * depth * perspective;
        const previousPerspective = 1 / Math.min(star.z + star.speed * 8, 1);
        const previousX = centerX + star.x * depth * previousPerspective;
        const previousY = centerY + star.y * depth * previousPerspective;

        if (x < -60 || x > width + 60 || y < -60 || y > height + 60) {
          Object.assign(star, createStar());
          continue;
        }

        const alpha = Math.min(1, (1 - star.z) * 1.3 + 0.1);
        ctx.strokeStyle = `hsla(${star.hue}, 100%, 78%, ${alpha * 0.44})`;
        ctx.lineWidth = Math.max(0.35, star.size * perspective * 0.24);
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.fillStyle = `hsla(${star.hue + Math.sin(time * 0.001 + star.x) * 18}, 100%, 86%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.35, star.size * perspective * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawRiftParticles(time: number) {
      const centerX = width * (0.61 + pointer.x * 0.032);
      const centerY = height * (0.41 + pointer.y * 0.032);
      const ringScale = Math.min(width, height) * 0.62;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (const spark of sparks) {
        spark.angle += reducedMotion ? 0 : spark.speed;
        const wobble = Math.sin(time * 0.0017 + spark.phase) * 0.045;
        const orbit = (spark.radius + wobble) * ringScale;
        const x = centerX + Math.cos(spark.angle) * orbit * 1.34;
        const y = centerY + Math.sin(spark.angle * 1.12) * orbit * 0.58;
        const alpha = 0.36 + Math.sin(time * 0.002 + spark.phase) * 0.24;

        ctx.fillStyle = `rgba(115, 236, 255, ${alpha})`;
        ctx.shadowColor = 'rgba(79, 220, 255, 0.7)';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(x, y, spark.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      for (let ring = 0; ring < 4; ring += 1) {
        const radius = ringScale * (0.18 + ring * 0.105 + Math.sin(time * 0.0008 + ring) * 0.01);
        ctx.strokeStyle = `rgba(${ring % 2 ? '238, 91, 255' : '99, 240, 255'}, ${0.16 - ring * 0.018})`;
        ctx.lineWidth = 1.2 + ring * 0.3;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radius * 1.6, radius * 0.72, time * 0.00018 + ring * 0.34, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawVignette() {
      const vignette = ctx.createRadialGradient(width * 0.5, height * 0.44, 0, width * 0.5, height * 0.44, width * 0.72);
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.58, 'rgba(0, 0, 0, 0.18)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.82)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    }

    function drawFrame(time: number) {
      if (!isVisible) return;

      pointer.x += (pointer.targetX - pointer.x) * 0.035;
      pointer.y += (pointer.targetY - pointer.y) * 0.035;

      drawNebula(time);
      drawStars(time);
      drawRiftParticles(time);
      drawVignette();

      if (!reducedMotion) {
        animationFrame = window.requestAnimationFrame(drawFrame);
      }
    }

    function resumeAnimation() {
      if (reducedMotion || animationFrame) return;
      animationFrame = window.requestAnimationFrame(drawFrame);
    }

    function handleVisibilityChange() {
      isVisible = !document.hidden;
      if (!isVisible) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        return;
      }
      resumeAnimation();
    }

    function handlePointerMove(event: PointerEvent) {
      pointer.targetX = (event.clientX / Math.max(1, width) - 0.5) * 2;
      pointer.targetY = (event.clientY / Math.max(1, height) - 0.5) * 2;
    }

    resizeCanvas();
    drawFrame(0);

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="title-space-canvas absolute inset-0 h-full w-full" aria-hidden="true" />;
}
