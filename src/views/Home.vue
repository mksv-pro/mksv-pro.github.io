<template>
  <div class="home">
    <div class="container-lg py-8">
      <div class="layout-two-col">
        <!-- LEFT SIDEBAR: Profile & Navigation -->
        <Sidebar />

        <!-- RIGHT CONTENT: Main Content -->
        <main class="main-content">
          <!-- Experience Section -->
          <section class="mb-6">
            <div class="section-header mb-4">
              <h2 class="section-title">Experience</h2>
            </div>

            <div class="card">
              <div v-for="(exp, index) in experiencesData" :key="exp.id"
                   :style="{ marginBottom: index < experiencesData.length - 1 ? 'var(--space-4)' : '0', paddingBottom: index < experiencesData.length - 1 ? 'var(--space-4)' : '0', borderBottom: index < experiencesData.length - 1 ? '1px solid var(--color-border)' : 'none' }">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <h3 class="text-base font-semibold m-0">{{ exp.title }}</h3>
                    <p class="text-secondary m-0 text-sm">{{ exp.institution }}</p>
                  </div>
                  <span class="badge" style="flex-shrink: 0;">{{ exp.period }}</span>
                </div>

                <p class="text-sm text-secondary mb-2" style="line-height: 1.5;">{{ exp.description }}</p>

                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(skill, index) in exp.skills"
                    :key="index"
                    :class="['badge', `badge-${skill.variant}`]"
                  >
                    {{ skill.name }}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <div class="divider" style="margin: var(--space-6) 0;"></div>

          <!-- Skills Section -->
          <section>
            <div class="section-header mb-4">
              <h2 class="section-title">Skills & Expertise</h2>
              <p class="text-sm text-secondary" style="margin-top: var(--space-2);">
                Interactive visualization showing skills organized from theory to practice.
                Hover over nodes to explore, drag to reposition, scroll to zoom, click to highlight connections.
              </p>
            </div>

            <SkillsTree />
          </section>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { experiences } from '../data/content.js'
import SkillsTree from '../components/SkillsTree.vue'
import Sidebar from '../components/Sidebar.vue'

const experiencesData = experiences

</script>

<style scoped>
.home {
  min-height: 100vh;
}
</style>
