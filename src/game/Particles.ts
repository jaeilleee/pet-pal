/**
 * Particles -- 파티클 시스템 (하트, 별, 음표, 거품 등)
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  type: ParticleType;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
}

export type ParticleType = 'heart' | 'star' | 'sparkle' | 'note' | 'bubble' | 'leaf' | 'snowflake' | 'petal';

export class ParticleSystem {
  private particles: Particle[] = [];
  private maxParticles = 50;

  emit(x: number, y: number, type: ParticleType, count: number = 5): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push(this.createParticle(x, y, type));
    }
  }

  /** 지속적으로 파티클 방출 (날씨 등) */
  emitAmbient(width: number, height: number, type: ParticleType): void {
    if (this.particles.length >= this.maxParticles) return;
    const x = Math.random() * width;
    const y = -10;
    this.particles.push(this.createParticle(x, y, type));
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotSpeed * dt;
      // Gravity for some types
      if (p.type === 'leaf' || p.type === 'petal' || p.type === 'snowflake') {
        p.vx += Math.sin(p.life * 3) * 10 * dt; // sway
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.min(1, p.life / (p.maxLife * 0.3));
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      this.drawParticle(ctx, p);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  get count(): number {
    return this.particles.length;
  }

  private createParticle(x: number, y: number, type: ParticleType): Particle {
    const base: Particle = {
      x, y,
      vx: (Math.random() - 0.5) * 60,
      vy: -30 - Math.random() * 60,
      life: 1 + Math.random(),
      maxLife: 1.5,
      type,
      size: 6 + Math.random() * 6,
      color: '#FF6B8A',
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 3,
    };

    switch (type) {
      case 'heart':
        base.color = ['#FF6B8A', '#FF4D6D', '#FFB5C2'][Math.floor(Math.random() * 3)];
        base.vy = -40 - Math.random() * 40;
        break;
      case 'star':
        base.color = ['#FFD700', '#FFA500', '#FFEB3B'][Math.floor(Math.random() * 3)];
        break;
      case 'sparkle':
        base.color = '#FFD700';
        base.size = 3 + Math.random() * 4;
        base.life = 0.5 + Math.random() * 0.5;
        base.maxLife = 1;
        break;
      case 'note':
        base.color = '#7C4DFF';
        base.vy = -50 - Math.random() * 30;
        base.size = 10 + Math.random() * 4;
        break;
      case 'bubble':
        base.color = '#87CEEB';
        base.vy = -20 - Math.random() * 30;
        base.vx = (Math.random() - 0.5) * 20;
        base.life = 2 + Math.random();
        base.maxLife = 3;
        break;
      case 'leaf':
        base.color = ['#4CAF50', '#8BC34A', '#FFC107'][Math.floor(Math.random() * 3)];
        base.vy = 20 + Math.random() * 30;
        base.vx = -10 + Math.random() * 20;
        base.life = 3 + Math.random() * 2;
        base.maxLife = 5;
        break;
      case 'snowflake':
        base.color = '#FFFFFF';
        base.vy = 15 + Math.random() * 20;
        base.vx = (Math.random() - 0.5) * 15;
        base.life = 4 + Math.random() * 2;
        base.maxLife = 6;
        base.size = 4 + Math.random() * 6;
        break;
      case 'petal':
        base.color = ['#FFB5C2', '#FF9AA2', '#FFDAC1'][Math.floor(Math.random() * 3)];
        base.vy = 15 + Math.random() * 25;
        base.vx = -5 + Math.random() * 10;
        base.life = 3 + Math.random() * 2;
        base.maxLife = 5;
        base.size = 5 + Math.random() * 5;
        break;
    }

    return base;
  }

  private drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
    ctx.fillStyle = p.color;

    switch (p.type) {
      case 'heart':
        this.drawHeart(ctx, p.size);
        break;
      case 'star':
        this.drawStar(ctx, p.size);
        break;
      case 'sparkle':
        this.drawSparkle(ctx, p.size);
        break;
      case 'note':
        ctx.font = `${p.size}px sans-serif`;
        ctx.fillText('♪', 0, 0);
        break;
      case 'bubble':
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = p.color + '30';
        ctx.fill();
        break;
      case 'leaf':
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.4, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'snowflake':
        this.drawSnowflake(ctx, p.size);
        break;
      case 'petal':
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.3, p.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  }

  private drawHeart(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.beginPath();
    ctx.moveTo(0, size * 0.3);
    ctx.bezierCurveTo(-size, -size * 0.3, -size * 0.5, -size, 0, -size * 0.5);
    ctx.bezierCurveTo(size * 0.5, -size, size, -size * 0.3, 0, size * 0.3);
    ctx.fill();
  }

  private drawStar(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const outerX = Math.cos(angle) * size;
      const outerY = Math.sin(angle) * size;
      const innerAngle = angle + Math.PI / 5;
      const innerX = Math.cos(innerAngle) * size * 0.4;
      const innerY = Math.sin(innerAngle) * size * 0.4;
      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(outerX, outerY);
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawSparkle(ctx: CanvasRenderingContext2D, size: number): void {
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.stroke();
    }
  }

  private drawSnowflake(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.strokeStyle = ctx.fillStyle as string;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}
