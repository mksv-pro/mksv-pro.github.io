import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Research from '../views/Research.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/research',
    name: 'Research',
    component: Research
  }
]

const router = createRouter({
  history: createWebHistory('/'),
  routes
})

export default router
