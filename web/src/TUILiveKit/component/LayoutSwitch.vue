<template>
  <div
    class="custom-icon-container"
    :class="{ 'disabled': disabled }"
    @click="handleSwitchLayout"
  >
    <IconLayoutTemplate class="custom-icon" />
    <span class="custom-text setting-text">Modos</span>
  </div>
  <TUIDialog
    :custom-classes="['layout-dialog']"
    title="Modos"
    :visible="layoutSwitchVisible"
    :confirm-text="t('Confirm')"
    :cancel-text="t('Cancel')"
    @close="handleCancel"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="layout-label">
      Cómo se ven la cámara y los co-host
    </div>
    <div class="template-options">
      <div class="options-grid">
        <template
          v-for="template in layoutOptions"
          :key="template.id"
        >
          <div
            class="option-card"
            :class="{ active: selectedTemplate === template.templateId }"
            @click="selectTemplate(template.templateId)"
          >
            <div class="option-thumb">
              <component
                :is="template.icon"
                v-if="template.icon"
                class="option-icon"
              />
            </div>
            <div class="option-info">
              <h4>{{ template.label }}</h4>
              <p v-if="template.desc">{{ template.desc }}</p>
            </div>
            <span class="option-check" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </span>
          </div>
        </template>
      </div>
    </div>
  </TUIDialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import { TUIErrorCode  } from '@tencentcloud/tuiroom-engine-js';
import { useUIKit, TUIDialog, TUIToast, TOAST_TYPE, IconLayoutTemplate } from '@tencentcloud/uikit-base-component-vue3';
import { useLiveListState, useCoHostState, CoHostStatus, useLiveSeatState } from 'tuikit-atomicx-vue3';
import { TUISeatLayoutTemplate } from '../types/LivePusher';
import Dynamic1v6 from '../icons/dynamic-1v6.vue';
import DynamicGrid9 from '../icons/dynamic-grid9.vue';
import Fixed1v6 from '../icons/fixed-1v6.vue';
import FixedGrid9 from '../icons/fixed-grid9.vue';
import HorizontalFloat from '../icons/horizontal-float.vue';

const { t } = useUIKit();
const { currentLive, updateLiveInfo } = useLiveListState();
const { coHostStatus } = useCoHostState();
const { seatList } = useLiveSeatState();
const disabled = computed(() => coHostStatus.value === CoHostStatus.Connected);

const layoutSwitchVisible = ref(false);

const handleSwitchLayout = () => {
  if (disabled.value) {
    TUIToast({ type: TOAST_TYPE.ERROR, message: t('Layout switching is not available during co-hosting') });
    return;
  }
  layoutSwitchVisible.value = true;
};

const portraitLayoutOptions = computed(() => [
  {
    id: 'PortraitDynamic_Grid9',
    icon: DynamicGrid9,
    templateId: TUISeatLayoutTemplate.PortraitDynamic_Grid9,
    label: t('Dynamic Grid9 Layout'),
    desc: 'Las cámaras se acomodan solas según cuántos entren (hasta 9).',
  },
  {
    id: 'PortraitFixed_1v6',
    icon: Fixed1v6,
    templateId: TUISeatLayoutTemplate.PortraitFixed_1v6,
    label: t('Fixed 1v6 Layout'),
    desc: 'Tú en grande y hasta 6 invitados en fila.',
  },
  {
    id: 'PortraitFixed_Grid9',
    icon: FixedGrid9,
    templateId: TUISeatLayoutTemplate.PortraitFixed_Grid9,
    label: t('Fixed Grid9 Layout'),
    desc: 'Cuadrícula fija de 9 espacios iguales.',
  },
  {
    id: 'PortraitDynamic_1v6',
    icon: Dynamic1v6,
    templateId: TUISeatLayoutTemplate.PortraitDynamic_1v6,
    label: t('Dynamic 1v6 Layout'),
    desc: 'Tú en grande; los invitados aparecen al unirse.',
  },
]);

const horizontalLayoutOptions = computed(() => [
  {
    id: 'LandscapeDynamic_1v3',
    icon: HorizontalFloat,
    templateId: TUISeatLayoutTemplate.LandscapeDynamic_1v3,
    label: t('Landscape Template'),
    desc: 'Modo horizontal con hasta 3 invitados.',
  },
]);

const layoutOptions = computed(() => {
  if (currentLive.value && currentLive.value?.layoutTemplate >= 200 && currentLive.value?.layoutTemplate <= 599) {
    return horizontalLayoutOptions.value;
  }
  return portraitLayoutOptions.value;
});

const selectedTemplate = ref<TUISeatLayoutTemplate | null>(currentLive.value?.layoutTemplate ?? null);

/**
 * Check if switching from Grid9 layout to target layout is allowed
 * Main validation: If current layout is Grid9 and last two seats (8th, 9th) have users,
 * cannot switch to non-Grid9 layouts because Grid9 capacity > 1V6 capacity
 * @param template - Target layout template to switch to
 * @returns Object with enable flag and error message
 */
function checkTemplateInGrid9SwitchEnable(template: TUISeatLayoutTemplate) : {enable: boolean, message: string} {
  const lastSeatIndexArray = [7, 8]; // The index of 8th and 9th seats (0-based indexing)
  const isUserSeatedOnLastTwoSeats = seatList.value.some(seat => seat.userInfo?.userId && lastSeatIndexArray.includes(seat.index));
  if (isUserSeatedOnLastTwoSeats && (template !== TUISeatLayoutTemplate.PortraitFixed_Grid9 && template !== TUISeatLayoutTemplate.PortraitDynamic_Grid9)) {
    return { enable: false, message: t('The new layout cannot display all users on the seat') };
  }
  return { enable: true, message: '' };
}

function checkTemplateIn1V6SwitchEnable(template: TUISeatLayoutTemplate): { enable: boolean, message: string } {
  /**
   * Check if switching from a 1v6 layout to target layout is allowed
   * Current implementation: Always allows switching (placeholder)
   *
   * Business considerations for future implementation:
   * 1. Switching from 1v6 to 9-grid layout should always be allowed (capacity upgrade)
   * 2. Switching between different variants of 1v6 layout should be allowed
   * 3. Switching from 1v6 to other layouts may need compatibility checks based on
   *    user seating positions and layout-specific constraints
   *
   * Note: This function is currently a placeholder and needs to be implemented
   * based on specific business requirements for 1v6 layout switching.
   */
  return { enable: true, message: '' };
}

function checkSwitchTemplateEnable(template: TUISeatLayoutTemplate) : {enable: boolean, message: string} {
  /**
   * Main dispatcher function for layout switching validation
   *
   * This function routes the validation request to the appropriate
   * layout-specific checking function based on the current layout type.
   *
   * Supported layout types:
   * - PortraitFixed_Grid9, PortraitDynamic_Grid9 → checkTemplateInGrid9SwitchEnable
   * - PortraitFixed_1v6, PortraitDynamic_1v6 → checkTemplateIn1V6SwitchEnable
   * - Other layouts → Directly allowed (no specific constraints)
   *
   * Returns: {enable: boolean, message: string} where:
   * - enable: true if switching is allowed, false otherwise
   * - message: Error message if switching is not allowed, empty string otherwise
   */
  switch (selectedTemplate.value) {
    case TUISeatLayoutTemplate.PortraitFixed_Grid9:
    case TUISeatLayoutTemplate.PortraitDynamic_Grid9:
      return checkTemplateInGrid9SwitchEnable(template);
    case TUISeatLayoutTemplate.PortraitFixed_1v6:
    case TUISeatLayoutTemplate.PortraitDynamic_1v6:
      return checkTemplateIn1V6SwitchEnable(template);
    default:
      return {
        enable: true,
        message: '',
      };
  }
}

function selectTemplate(template: TUISeatLayoutTemplate) {
  const { enable, message } = checkSwitchTemplateEnable(template);
  if (!enable) {
    TUIToast({
      type: TOAST_TYPE.ERROR,
      message,
    });
    return;
  }
  selectedTemplate.value = template;
}

watch(() => currentLive.value?.layoutTemplate, (newVal) => {
  if (newVal) {
    selectedTemplate.value = newVal;
  }
});

async function handleConfirm() {
  if (selectedTemplate.value  === currentLive.value?.layoutTemplate) {
    layoutSwitchVisible.value = false;
    return;
  }
  if (selectedTemplate.value) {
    try {
      await updateLiveInfo({ layoutTemplate: selectedTemplate.value });
      layoutSwitchVisible.value = false;
    } catch (error: any) {
      let errorMessage = t('Layout switch failed');
      if (error.code === TUIErrorCode.ERR_FREQ_LIMIT) {
        errorMessage = t('Operation too frequent, please try again later');
      }
      TUIToast({ type: TOAST_TYPE.ERROR, message: errorMessage });
    }
  } else {
    layoutSwitchVisible.value = false;
  }
}

function handleCancel() {
  selectedTemplate.value = currentLive.value?.layoutTemplate ?? null;
  layoutSwitchVisible.value = false;
}
</script>

<style lang="scss" scoped>
@import '../style/index.scss';

.custom-icon-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 56px;
  width: auto;
  height: 56px;
  cursor: pointer;
  color: $text-color1;
  border-radius: 12px;
  position: relative;

  .custom-icon {
    @include icon-size-24;
    background: transparent;
  }
  .custom-text {
    @include text-size-12;
  }

  &:not(.disabled):hover {
    box-shadow: 0 0 10px 0 var(--bg-color-mask);
    .custom-icon {
      color: $icon-hover-color;
    }
    .custom-text {
      color: $icon-hover-color;
    }
  }
  &.disabled {
    cursor: not-allowed;
    opacity: 0.5;
    color: $text-color3;
    .custom-icon {
      color: $text-color3;
      cursor: not-allowed;
    }
    .custom-text {
      color: $text-color3;
    }
  }
}

:deep(.layout-dialog) {
  padding: 22px 20px;
  width: 460px;
  max-width: calc(100vw - 32px);
  border-radius: 24px;
  .tui-dialog-body {
    flex-wrap: wrap;
  }
  .tui-dialog-footer {
    padding-top: 24px;
  }
}

.layout-label {
  @include text-size-14;
  color: rgba(255, 255, 255, 0.55);
  margin: 2px 0 18px 0;
  text-align: center;
}

.template-options {
  width: 100%;
  height: 100%;
  overflow: auto;

  .options-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .option-card {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 14px;
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1.5px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease;

      &:active {
        transform: scale(0.98);
      }
      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      .option-thumb {
        flex: 0 0 auto;
        width: 46px;
        height: 46px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        background: rgba(139, 61, 255, 0.14);
        .option-icon {
          width: 26px;
          height: 26px;
          color: #c79bff;
        }
      }

      .option-info {
        flex: 1 1 auto;
        min-width: 0;
        text-align: left;
        h4 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
        }
        p {
          margin: 3px 0 0;
          font-size: 12px;
          line-height: 1.3;
          color: rgba(255, 255, 255, 0.5);
        }
      }

      .option-check {
        flex: 0 0 auto;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.25);
        color: transparent;
        transition: all 0.2s ease;
      }

      &.active {
        border-color: transparent;
        background: linear-gradient(135deg, rgba(139, 61, 255, 0.28), rgba(255, 46, 116, 0.22));
        box-shadow: 0 0 0 1.5px rgba(199, 155, 255, 0.55) inset;
        .option-thumb {
          background: rgba(255, 255, 255, 0.16);
          .option-icon { color: #fff; }
        }
        .option-check {
          border-color: transparent;
          background: linear-gradient(135deg, #8b3dff, #ff2e74);
          color: #fff;
        }
      }
    }
  }
}

.setting-icon {
  mask-image: url('../icons/setting-icon.svg');
}

.setting-panel {
  display: flex;
  flex-direction: column;
  max-height: 600px;
  width: 100%;
  overflow: auto;
  @include scrollbar;
}
</style>
