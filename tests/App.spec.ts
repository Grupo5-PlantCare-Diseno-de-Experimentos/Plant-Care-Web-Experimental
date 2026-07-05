import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import App from '../src/App.vue';

let routeMeta: Record<string, unknown> = {};

vi.mock('vue-router', () => ({
  useRoute: () => ({ meta: routeMeta })
}));

vi.mock('../src/shared/presentation/components/Header.vue', () => ({
  default: { template: '<header class="header-stub" />' }
}));

vi.mock('../src/shared/presentation/components/Sidebar.vue', () => ({
  default: { template: '<aside class="sidebar-stub" />' }
}));

vi.mock('@vercel/speed-insights', () => ({
  injectSpeedInsights: vi.fn()
}));

vi.mock('../src/Profile/application/profile.store', () => ({
  useProfileStore: () => ({
    newAchievements: [],
    clearNewAchievements: vi.fn(),
    fetchAchievements: vi.fn()
  })
}));

describe('App', () => {
  it('renders layout when route does not hide it', () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    routeMeta = {};
    const wrapper = mount(App, {
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.app-layout').exists()).toBe(true);
    expect(wrapper.find('.sidebar-stub').exists()).toBe(true);
    expect(wrapper.find('.header-stub').exists()).toBe(true);
  });

  it('renders router view only when layout is hidden', () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    routeMeta = { hideLayout: true };
    const wrapper = mount(App, {
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.app-layout').exists()).toBe(false);
  });
});

