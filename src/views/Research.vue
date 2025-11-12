<template>
  <div class="research-page">
    <div class="container-lg py-8">
      <div class="layout-two-col">
        <!-- LEFT SIDEBAR: Profile & Navigation -->
        <Sidebar />

        <!-- RIGHT CONTENT: Projects & Publications -->
        <main class="main-content">
          <!-- Projects Section -->
          <section class="mb-8">
        <div class="section-header mb-4">
          <h2 class="section-title">Research Projects</h2>
          <p class="text-secondary text-sm">Computational research and software development projects</p>
        </div>

        <div class="grid grid-2">
          <div class="card card-interactive" v-for="project in projectsData" :key="project.id" style="border: 1px solid var(--color-border);">
            <div class="mb-3">
              <h3 class="text-base font-semibold mb-3">{{ project.title }}</h3>

              <p class="text-secondary mb-3 text-sm">{{ project.description }}</p>

              <!-- Technologies -->
              <div class="flex flex-wrap gap-2 mb-3">
                <span
                  v-for="(tech, index) in project.technologies"
                  :key="index"
                  :class="['badge', `badge-${tech.variant}`]"
                >
                  {{ tech.name }}
                </span>
              </div>

              <!-- Metrics -->
              <div v-if="project.linesOfCode || project.complexity || project.duration" class="flex flex-wrap gap-3 mb-3 text-xs text-tertiary">
                <span v-if="project.linesOfCode">
                  <strong class="text-secondary">{{ formatNumber(project.linesOfCode) }}</strong> lines
                </span>
                <span v-if="project.complexity">
                  <strong class="text-secondary">{{ project.complexity }}</strong> complexity
                </span>
                <span v-if="project.duration">
                  <strong class="text-secondary">{{ project.duration }}</strong>
                </span>
              </div>
            </div>

            <!-- Links -->
            <div class="flex gap-2 flex-wrap">
              <a v-if="project.github" :href="project.github" class="btn btn-sm btn-secondary" target="_blank">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                Code
              </a>
              <a v-if="project.demo" :href="project.demo" class="btn btn-sm btn-outline" target="_blank">
                Demo
              </a>
              <a v-if="project.paper" :href="project.paper" class="btn btn-sm btn-outline" target="_blank">
                Paper
              </a>
            </div>

            <!-- Associated Publications -->
            <div v-if="project.publications && project.publications.length" class="mt-3 pt-3" style="border-top: 1px solid var(--color-border);">
              <p class="text-xs text-tertiary mb-1">Related publications</p>
              <div class="flex flex-col gap-1">
                <a
                  v-for="pub in project.publications"
                  :key="pub"
                  href="#publications"
                  class="link-primary text-xs"
                >
                  {{ pub }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="divider" style="margin: var(--space-8) 0;"></div>

      <!-- Publications Section -->
      <section id="publications">
        <div class="section-header mb-4">
          <h2 class="section-title">Publications</h2>
          <p class="text-secondary text-sm">Peer-reviewed articles and conference papers</p>
        </div>

        <div class="grid grid-1">
          <div class="card" v-for="publication in publicationsData" :key="publication.id" style="border: 1px solid var(--color-border);">
            <div class="mb-3">
              <div class="flex gap-2 mb-2">
                <span class="badge">{{ publication.year }}</span>
                <span :class="['badge', publication.type === 'Journal' ? 'badge-vision' : 'badge-audio']">
                  {{ publication.type }}
                </span>
              </div>
              <h3 class="text-base font-semibold mb-2">{{ publication.title }}</h3>
              <p class="text-xs text-tertiary mb-1" style="font-style: italic;">{{ publication.authors }}</p>
              <p class="text-sm font-semibold text-primary mb-3">{{ publication.venue }}</p>
            </div>

            <p class="text-secondary mb-3 text-sm" style="line-height: 1.6;">{{ publication.abstract }}</p>

            <!-- Metrics -->
            <div v-if="publication.citations || publication.downloads" class="flex gap-4 mb-3 text-xs">
              <span v-if="publication.citations" class="text-tertiary">
                <strong class="text-secondary">{{ publication.citations }}</strong> citations
              </span>
              <span v-if="publication.downloads" class="text-tertiary">
                <strong class="text-secondary">{{ formatNumber(publication.downloads) }}</strong> downloads
              </span>
            </div>

            <!-- Links -->
            <div class="flex gap-2 flex-wrap">
              <a v-if="publication.pdf" :href="publication.pdf" class="btn btn-sm btn-primary" target="_blank">
                PDF
              </a>
              <a v-if="publication.doi" :href="publication.doi" class="btn btn-sm btn-secondary" target="_blank">
                DOI
              </a>
              <a v-if="publication.code" :href="publication.code" class="btn btn-sm btn-secondary" target="_blank">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                Code
              </a>
              <a v-if="publication.slides" :href="publication.slides" class="btn btn-sm btn-outline" target="_blank">
                Slides
              </a>
            </div>
          </div>
        </div>
      </section>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { projects, publications } from '../data/content.js'
import Sidebar from '../components/Sidebar.vue'

const projectsData = ref(projects)
const publicationsData = ref(publications)

const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US').format(num)
}
</script>

<style scoped>
.research-page {
  min-height: 100vh;
}

/* Responsive */
@media (max-width: 768px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
