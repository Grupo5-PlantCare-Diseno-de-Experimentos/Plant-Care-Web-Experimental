// Rutas internas del bounded context Ai
export default [
  {
    path: '',
    name: 'AiHome',
    component: () => import('./views/AiChat.vue'),
  }
];
