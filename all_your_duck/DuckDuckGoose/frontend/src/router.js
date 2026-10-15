import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/corpus' },
  { path: '/corpus', name: 'corpus', component: () => import('./views/CorpusView.vue') },
  { path: '/universe', name: 'universe', component: () => import('./views/UniverseView.vue') },
  { path: '/run', name: 'run', component: () => import('./views/RunView.vue') },
  { path: '/story', name: 'story', component: () => import('./views/StoryFeedView.vue') },
  { path: '/results', name: 'results', component: () => import('./views/ResultsView.vue') },
  { path: '/talk', name: 'talk', component: () => import('./views/TalkView.vue') },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
