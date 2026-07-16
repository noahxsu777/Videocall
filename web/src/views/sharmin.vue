<template>
  <div class="sharmin-page">
    <header class="nav">
      <GlassBackButton @click="router.back()" />
      <span class="nav-title">Registro de IPs</span>
      <button class="refresh" @click="load" :disabled="loading">↻</button>
    </header>

    <div v-if="loading" class="state-msg">Cargando…</div>
    <div v-else-if="loadError" class="state-msg err">{{ loadError }}</div>

    <template v-else>
      <div class="panel">
        <div class="stats-row">
          <div class="stat"><span class="stat-num">{{ visitors.length }}</span><span class="stat-label">IPs únicas</span></div>
          <div class="stat"><span class="stat-num">{{ totalVisits }}</span><span class="stat-label">Visitas totales</span></div>
        </div>

        <div class="search-wrap">
          <input v-model.trim="query" class="search" type="text" placeholder="Buscar por IP o nombre…" />
        </div>

        <div class="row-list">
          <div v-for="v in filteredVisitors" :key="v.ip || ''" class="row-card">
            <span class="row-flag">{{ v.flag || '🌐' }}</span>
            <div class="row-info">
              <div class="row-top">
                <span class="row-ip">{{ v.ip || '—' }}</span>
                <span v-if="v.visits > 1" class="chip">{{ v.visits }}× visitas</span>
              </div>
              <span class="row-loc">{{ locationText(v) }}</span>
              <span class="row-isp">📶 {{ v.isp || 'Operador desconocido' }}</span>
              <span v-if="v.name" class="row-name">👤 {{ v.name }}</span>
              <span class="row-ua">{{ v.user_agent || 'Dispositivo desconocido' }}</span>
            </div>
            <span class="row-time">{{ relativeTime(v.last_seen) }}</span>
          </div>
          <p v-if="filteredVisitors.length === 0" class="empty">
            {{ visitors.length === 0 ? 'Aún no hay visitas registradas.' : 'Sin resultados.' }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import { listVisitors, type VisitorRow } from '../data/admin';

const router = useRouter();

const loading = ref(true);
const loadError = ref('');
const visitors = ref<VisitorRow[]>([]);
const query = ref('');

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    visitors.value = await listVisitors();
  } catch (error: any) {
    loadError.value = `No se pudo cargar: ${error?.message || 'error'}`;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const filteredVisitors = computed(() => {
  const q = query.value.toLowerCase();
  if (!q) {
    return visitors.value;
  }
  return visitors.value.filter(v =>
    (v.ip || '').toLowerCase().includes(q)
    || (v.name || '').toLowerCase().includes(q)
    || (v.country || '').toLowerCase().includes(q)
    || (v.city || '').toLowerCase().includes(q)
    || (v.isp || '').toLowerCase().includes(q));
});

const totalVisits = computed(() => visitors.value.reduce((sum, v) => sum + (v.visits || 0), 0));

function locationText(v: VisitorRow): string {
  const parts = [v.city, v.country].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Ubicación desconocida';
}

function relativeTime(iso: string): string {
  if (!iso) {
    return '';
  }
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) {
    return 'ahora mismo';
  }
  if (min < 60) {
    return `hace ${min} min`;
  }
  const hours = Math.floor(min / 60);
  if (hours < 24) {
    return `hace ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}
</script>

<style scoped>
.sharmin-page {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #000;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
  padding-bottom: 40px;
}
.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  padding: 0 8px;
  background: rgba(0, 0, 0, 0.7);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.1);
}
.nav-title { font-size: 15px; font-weight: 700; }
.refresh {
  min-width: 44px;
  height: 40px;
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
}
.refresh:disabled { opacity: 0.4; }

.state-msg { text-align: center; padding: 40px 20px; color: #8e8e93; font-size: 14px; }
.state-msg.err { color: #ff453a; }

.panel { padding: 14px 16px; }

.stats-row { display: flex; gap: 8px; margin-bottom: 14px; }
.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 4px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
}
.stat-num { font-size: 18px; font-weight: 800; }
.stat-label { font-size: 10.5px; color: #8e8e93; text-transform: uppercase; letter-spacing: 0.3px; }

.search-wrap { margin-bottom: 12px; }
.search {
  width: 100%;
  height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding: 0 14px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.search::placeholder { color: #6a6a70; }

.row-list { display: flex; flex-direction: column; gap: 8px; }
.row-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(30, 30, 34, 0.55);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
}
.row-flag { font-size: 30px; flex-shrink: 0; line-height: 1; }
.row-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.row-top { display: flex; align-items: center; gap: 8px; }
.row-ip {
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 15px;
  font-weight: 700;
}
.row-loc { font-size: 13px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-isp { font-size: 11.5px; color: #34c759; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip {
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(52, 199, 89, 0.2);
  color: #34c759;
  flex-shrink: 0;
}
.row-name { font-size: 12.5px; color: #c9c9ce; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-ua { font-size: 10.5px; color: #6a6a70; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-time { font-size: 11px; color: #8e8e93; flex-shrink: 0; }

.empty { text-align: center; color: #8e8e93; font-size: 13px; padding: 24px 0; line-height: 1.5; }
</style>
