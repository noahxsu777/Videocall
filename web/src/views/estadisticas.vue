<template>
  <div class="stats-page">
    <GlassBackButton />
    <h1 class="title">Estadísticas</h1>

    <!-- Skeleton while sessions load -->
    <div v-if="pageLoading" class="e-sk">
      <div class="e-sk-cards">
        <div v-for="n in 3" :key="n" class="sk e-sk-card" />
      </div>
      <div class="sk e-sk-streak" />
      <div class="sk e-sk-chart" />
      <div class="sk e-sk-chart" />
    </div>

    <!-- Totals -->
    <div class="cards">
      <div class="card">
        <span class="c-ico">⏱</span>
        <span class="c-val">{{ totalHoursText }}</span>
        <span class="c-lbl">Horas en vivo</span>
      </div>
      <div class="card">
        <span class="c-ico">🪙</span>
        <span class="c-val">{{ totalCoins.toLocaleString() }}</span>
        <span class="c-lbl">Coins ganados</span>
      </div>
      <div class="card">
        <span class="c-ico">🎥</span>
        <span class="c-val">{{ sessions.length }}</span>
        <span class="c-lbl">Lives</span>
      </div>
    </div>

    <!-- Streak -->
    <div class="streak-card">
      <span class="sk-fire">🔥</span>
      <div class="sk-info">
        <strong>Mejor racha: {{ streaks.best }} {{ streaks.best === 1 ? 'día' : 'días' }} seguidos</strong>
        <p v-if="streaks.current >= streaks.best && streaks.best > 0">
          ¡Estás en tu mejor racha ({{ streaks.current }} {{ streaks.current === 1 ? 'día' : 'días' }})! No la rompas hoy 💪
        </p>
        <p v-else-if="streaks.best > 0">
          Llevas {{ streaks.current }} {{ streaks.current === 1 ? 'día' : 'días' }} ahora — ¡puedes volver a conseguirla! Transmite hoy y acércate un día más.
        </p>
        <p v-else>
          Haz tu primer live para empezar tu racha de días transmitiendo.
        </p>
      </div>
    </div>

    <!-- Charts: last 14 days -->
    <p class="section-title">Horas por día (últimos 14 días)</p>
    <BarChart :values="hoursByDay" :labels="dayLabels" unit="h" color-a="#8b3dff" color-b="#c79bff" />

    <p class="section-title">Coins por día (últimos 14 días)</p>
    <BarChart :values="coinsByDay" :labels="dayLabels" unit="" color-a="#ff2e74" color-b="#ff8fb3" />

    <p v-if="!sessions.length" class="empty-hint">
      Aún no hay datos: tus horas, coins y rachas aparecerán aquí después de
      tu próximo live.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineComponent, h } from 'vue';
import GlassBackButton from '../components/GlassBackButton.vue';
import { useAuth } from '../auth/useAuth';
import { listLiveSessions, computeStreaks, type LiveSession } from '../data/stats';

const { user } = useAuth();
const sessions = ref<LiveSession[]>([]);
const pageLoading = ref(true);

const totalCoins = computed(() => sessions.value.reduce((a, s) => a + s.coins_earned, 0));
const totalHoursText = computed(() => {
  const secs = sessions.value.reduce((a, s) => a + s.duration_seconds, 0);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
});
const streaks = computed(() => computeStreaks(sessions.value));

// Last 14 days, oldest → newest.
const days = computed(() => {
  const out: string[] = [];
  for (let i = 13; i >= 0; i--) {
    out.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
});
const dayLabels = computed(() =>
  days.value.map(d => String(parseInt(d.slice(8), 10))));
const hoursByDay = computed(() => days.value.map((d) => {
  const secs = sessions.value
    .filter(s => s.created_at.slice(0, 10) === d)
    .reduce((a, s) => a + s.duration_seconds, 0);
  return Math.round((secs / 3600) * 10) / 10;
}));
const coinsByDay = computed(() => days.value.map(d =>
  sessions.value
    .filter(s => s.created_at.slice(0, 10) === d)
    .reduce((a, s) => a + s.coins_earned, 0)));

// Tiny dependency-free SVG bar chart.
const BarChart = defineComponent({
  props: {
    values: { type: Array as () => number[], required: true },
    labels: { type: Array as () => string[], required: true },
    unit: { type: String, default: '' },
    colorA: { type: String, default: '#8b3dff' },
    colorB: { type: String, default: '#c79bff' },
  },
  setup(props) {
    return () => {
      const W = 340;
      const H = 130;
      const pad = 6;
      const n = props.values.length || 1;
      const bw = (W - pad * 2) / n;
      const max = Math.max(...props.values, 1);
      const gid = `g${props.colorA.replace('#', '')}`;
      const bars = props.values.map((v, i) => {
        const bh = Math.max(v > 0 ? 4 : 2, (v / max) * (H - 34));
        return h('g', { key: i }, [
          h('rect', {
            x: pad + i * bw + bw * 0.18,
            y: H - 18 - bh,
            width: bw * 0.64,
            height: bh,
            rx: 3,
            fill: v > 0 ? `url(#${gid})` : 'rgba(255,255,255,0.08)',
          }),
          h('text', {
            x: pad + i * bw + bw / 2,
            y: H - 6,
            'text-anchor': 'middle',
            'font-size': 8,
            fill: 'rgba(255,255,255,0.45)',
          }, props.labels[i]),
          v > 0
            ? h('text', {
              x: pad + i * bw + bw / 2,
              y: H - 22 - bh,
              'text-anchor': 'middle',
              'font-size': 8,
              'font-weight': 700,
              fill: 'rgba(255,255,255,0.85)',
            }, `${v}${props.unit}`)
            : null,
        ]);
      });
      return h('svg', {
        viewBox: `0 0 ${W} ${H}`,
        class: 'bar-chart',
        preserveAspectRatio: 'xMidYMid meet',
      }, [
        h('defs', {}, [
          h('linearGradient', { id: gid, x1: 0, y1: 1, x2: 0, y2: 0 }, [
            h('stop', { offset: '0%', 'stop-color': props.colorA }),
            h('stop', { offset: '100%', 'stop-color': props.colorB }),
          ]),
        ]),
        ...bars,
      ]);
    };
  },
});

onMounted(async () => {
  if (user.value) {
    sessions.value = await listLiveSessions(user.value.id);
  }
  pageLoading.value = false;
});
</script>

<style scoped>
.stats-page {
  position: relative;
  height: 100%;
  padding: 54px 16px 40px;
  box-sizing: border-box;
  background: #010101;
  color: #fff;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.title {
  margin: 0 0 18px;
  text-align: center;
  font-size: 20px;
  font-weight: 800;
}
/* Loading skeleton overlay */
.e-sk {
  position: absolute;
  top: 96px;
  left: 16px;
  right: 16px;
  bottom: 0;
  z-index: 5;
  background: #010101;
}
.e-sk-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
.e-sk-card { height: 84px; border-radius: 16px; }
.e-sk-streak { height: 88px; border-radius: 18px; margin-bottom: 20px; }
.e-sk-chart { height: 140px; border-radius: 16px; margin-bottom: 16px; }

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 16px 6px;
  border-radius: 16px;
  background: #121214;
  border: 1px solid rgba(255, 255, 255, 0.07);
}
.c-ico { font-size: 20px; }
.c-val { font-size: 17px; font-weight: 800; }
.c-lbl { font-size: 11px; color: #8a8a93; }
.streak-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255, 122, 0, 0.18), rgba(255, 46, 116, 0.15));
  border: 1px solid rgba(255, 160, 60, 0.35);
  margin-bottom: 20px;
}
.sk-fire { font-size: 28px; }
.sk-info strong { font-size: 15px; }
.sk-info p {
  margin: 5px 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.75);
}
.section-title {
  margin: 0 4px 8px;
  font-size: 15px;
  font-weight: 800;
}
:deep(.bar-chart) {
  width: 100%;
  height: auto;
  margin-bottom: 20px;
  background: #121214;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
}
.empty-hint {
  margin: 4px 6px 0;
  text-align: center;
  font-size: 13px;
  color: #8a8a93;
}
</style>
