import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import 'primeicons/primeicons.css';

import App from './App.vue';
import { DEFAULT_THEME } from './themes.js';

document.documentElement.classList.toggle('dark-mode', DEFAULT_THEME.dark);

const app = createApp(App);

app.use(PrimeVue, {
  theme: {
    preset: DEFAULT_THEME.preset,
    options: {
      darkModeSelector: '.dark-mode',
    },
  },
});

app.use(ToastService);

app.mount('#app');
