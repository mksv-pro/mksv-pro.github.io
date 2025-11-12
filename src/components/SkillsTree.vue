<template>
  <div class="skills-tree-container">
    <div class="visualization-wrapper">
      <div ref="svgContainer" class="svg-wrapper"></div>
      <div v-if="hoveredNode" class="tooltip" :style="tooltipStyle">
        <h4>{{ hoveredNode.data.name }}</h4>
        <p v-if="hoveredNode.data.variant" class="variant-badge" :class="`badge-${hoveredNode.data.variant}`">
          {{ hoveredNode.data.variant }}
        </p>
      </div>
    </div>

    <!-- Skill Details Panel -->
    <transition name="slide">
      <div v-if="selectedSkillDetails" class="details-panel">
        <div class="details-header">
          <h3>{{ selectedSkillDetails.name }}</h3>
          <button @click="closeDetails" class="close-btn">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
            </svg>
          </button>
        </div>

        <div class="details-content">
          <!-- Wiki Link -->
          <div v-if="selectedSkillDetails.wikiUrl" class="detail-section">
            <h4>Documentation</h4>
            <a :href="selectedSkillDetails.wikiUrl" target="_blank" class="wiki-link">
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8.5 1.5H1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a.5.5 0 0 0-1 0v8h-14v-12h7.5a.5.5 0 0 0 0-1z"/>
                <path d="M15.354.646a.5.5 0 0 1 0 .708l-8 8a.5.5 0 0 1-.708-.708l8-8a.5.5 0 0 1 .708 0z"/>
                <path d="M10 1h5v5a.5.5 0 0 1-1 0V2h-4a.5.5 0 0 1 0-1z"/>
              </svg>
              View Documentation
            </a>
          </div>

          <!-- Courses -->
          <div v-if="selectedSkillDetails.courses && selectedSkillDetails.courses.length" class="detail-section">
            <h4>Related Courses</h4>
            <ul class="courses-list">
              <li v-for="(course, index) in selectedSkillDetails.courses" :key="index">
                {{ course }}
              </li>
            </ul>
          </div>

          <!-- Experiences -->
          <div v-if="selectedSkillDetails.experiences && selectedSkillDetails.experiences.length" class="detail-section">
            <h4>Used in Experiences</h4>
            <ul class="usage-list">
              <li v-for="exp in selectedSkillDetails.experiences" :key="exp.id">
                <strong>{{ exp.title }}</strong>
                <span class="text-secondary">{{ exp.institution }}</span>
              </li>
            </ul>
          </div>

          <!-- Projects -->
          <div v-if="selectedSkillDetails.projects && selectedSkillDetails.projects.length" class="detail-section">
            <h4>Used in Projects</h4>
            <ul class="usage-list">
              <li v-for="project in selectedSkillDetails.projects" :key="project.id">
                <strong>{{ project.title }}</strong>
              </li>
            </ul>
          </div>

          <!-- No usage message -->
          <div v-if="!selectedSkillDetails.experiences?.length && !selectedSkillDetails.projects?.length" class="detail-section">
            <p class="text-secondary text-sm">No projects or experiences using this skill yet.</p>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as d3 from 'd3'
import { skillsTree } from '../data/skills.js'
import { skillsMetadata } from '../data/skillsMetadata.js'
import { getSkillUsage } from '../data/skillsSync.js'

const svgContainer = ref(null)
const hoveredNode = ref(null)
const selectedSkillDetails = ref(null)
const tooltipStyle = ref({})
const isSimulationRunning = ref(true)

let svg, simulation, nodes, links

// Initialize dimensions based on container size
const getInitialDimensions = () => {
  // Will be set properly in initVisualization based on actual container size
  return { width: 800, height: 500 }
}

const initialDims = getInitialDimensions()
const width = ref(initialDims.width)
const height = ref(initialDims.height)

// Color scale for different levels
const colorScale = {
  'Theory & Foundations': '#ef4444',
  'Applied Methods': '#3b82f6',
  'Computational': '#10b981',
  'Infrastructure': '#8b5cf6'
}

// Convert hierarchical data to flat nodes and links
function prepareData(treeData) {
  const hierarchy = d3.hierarchy(treeData)
  let nodesList = hierarchy.descendants()
  let linksList = hierarchy.links()

  // Remove the root node (depth 0) and its links
  nodesList = nodesList.filter(node => node.depth > 0)
  linksList = linksList.filter(link => link.source.depth > 0 && link.target.depth > 0)

  // Get the 4 main category nodes (depth 1)
  const mainNodes = nodesList.filter(node => node.depth === 1)

  // Create links between the 4 main categories in a cycle
  if (mainNodes.length === 4) {
    for (let i = 0; i < mainNodes.length; i++) {
      const nextIndex = (i + 1) % mainNodes.length
      linksList.push({
        source: mainNodes[i],
        target: mainNodes[nextIndex]
      })
    }
  }

  // Add properties for visualization

  nodesList.forEach((node, i) => {
    node.id = i
    node.radius = node.depth === 0 ? 12 : node.depth === 1 ? 9 : node.depth === 2 ? 7 : 5

    // Color by top-level category
    let topParent = node
    while (topParent.parent && topParent.parent.parent) {
      topParent = topParent.parent
    }
    node.color = topParent.data.color || colorScale[topParent.data.name] || '#9ca3af'

    // Position the 4 main nodes in a perfect square
    if (node.depth === 1) {
      const mainIndex = mainNodes.indexOf(node)
      const squareSize = 160 // Size of the square
      const centerX = width.value / 2
      const centerY = height.value / 2

      // Position nodes at the 4 corners of a square
      if (mainIndex === 0) { // Top-left
        node.x = centerX - squareSize / 2
        node.y = centerY - squareSize / 2
        node.fx = centerX - squareSize / 2
        node.fy = centerY - squareSize / 2
      } else if (mainIndex === 1) { // Top-right
        node.x = centerX + squareSize / 2
        node.y = centerY - squareSize / 2
        node.fx = centerX + squareSize / 2
        node.fy = centerY - squareSize / 2
      } else if (mainIndex === 2) { // Bottom-right
        node.x = centerX + squareSize / 2
        node.y = centerY + squareSize / 2
        node.fx = centerX + squareSize / 2
        node.fy = centerY + squareSize / 2
      } else if (mainIndex === 3) { // Bottom-left
        node.x = centerX - squareSize / 2
        node.y = centerY + squareSize / 2
        node.fx = centerX - squareSize / 2
        node.fy = centerY + squareSize / 2
      }
    } else {
      // Position hint based on hierarchy (for other nodes)
      const angle = (i / nodesList.length) * 2 * Math.PI
      const distance = node.depth * 100
      node.x = width.value / 2 + Math.cos(angle) * distance
      node.y = height.value / 2 + Math.sin(angle) * distance
    }

    // IMPORTANT: Ensure skillKey is available
    // If node doesn't have skillKey but has a name, try to find it from skills data
    if (!node.data.skillKey && node.depth >= 2) {
      // Try to infer skillKey from the name by converting to camelCase
      const inferSkillKey = (name) => {
        // Remove special chars and convert to camelCase
        return name
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .split(' ')
          .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join('')
      }
      node.data.skillKey = node.data.skillKey || inferSkillKey(node.data.name)
    }
  })

  return { nodes: nodesList, links: linksList }
}

function initVisualization() {
  if (!svgContainer.value) return

  // Get actual container dimensions
  const containerRect = svgContainer.value.getBoundingClientRect()
  width.value = containerRect.width
  height.value = Math.max(containerRect.height, 500)

  // Clear any existing SVG
  d3.select(svgContainer.value).selectAll('*').remove()

  // Create SVG that fills the container
  svg = d3.select(svgContainer.value)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', [0, 0, width.value, height.value])
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('background', 'var(--color-bg-primary)')

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 3])
    .on('zoom', (event) => {
      g.attr('transform', event.transform)
    })

  svg.call(zoom)

  const g = svg.append('g')

  // Prepare data
  const { nodes: nodeData, links: linkData } = prepareData(skillsTree)
  nodes = nodeData
  links = linkData

  // Create force simulation with continuous movement
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(d => {
        // Much shorter links for compact layout
        if (d.source.depth === 1 && d.target.depth === 1) return 120 // Links between main nodes
        return d.source.depth === d.target.depth ? 45 : 55 // More space between nodes
      })
      .strength(0.7) // Looser for better spacing
    )
    .force('charge', d3.forceManyBody()
      .strength(d => {
        // Much more repulsion for better spacing
        if (d.depth === 1) return -250 // Main categories
        if (d.depth === 2) return -180 // Mid-level categories - much more space
        return -150 * (d.radius / 5) // Leaf nodes - strong repulsion
      })
    )
    .force('center', d3.forceCenter(width.value / 2, height.value / 2).strength(0.08))
    .force('collision', d3.forceCollide()
      .radius(d => {
        // Much more collision radius based on label length
        const labelLength = d.data.name ? d.data.name.length : 10
        const extraSpace = labelLength > 20 ? 15 : labelLength > 15 ? 12 : 9
        return d.radius + extraSpace
      })
      .strength(0.98)
    )
    // Radial force to organize by depth - much more spaced
    .force('radial', d3.forceRadial(
      d => {
        if (d.depth === 1) return 100 // Main categories
        if (d.depth === 2) return 200 // Mid-level - much more space
        return 300 // Leaf nodes - lots of space for labels
      },
      width.value / 2,
      height.value / 2
    ).strength(0.4)) // Weaker for more organic spacing
    // Keep simulation running with very slow decay for continuous gentle movement
    .alphaDecay(0.0005) // Even slower decay for very gentle movement
    .velocityDecay(0.6) // Higher velocity decay to slow down movement
    .alphaTarget(0.015) // Lower target for more subtle animation

  // Draw links
  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', 'var(--color-border)')
    .attr('stroke-opacity', 0.4)
    .attr('stroke-width', d => Math.max(1, 3 - d.source.depth))

  // Draw nodes
  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => d.color)
    .attr('stroke', 'var(--color-bg-primary)')
    .attr('stroke-width', 2)
    .attr('opacity', 0.8)
    .style('cursor', 'pointer')
    .call(drag(simulation))

  // Add labels for all nodes depth 0-3 (including leaf nodes)
  const isMobile = window.innerWidth <= 768
  const label = g.append('g')
    .selectAll('text')
    .data(nodes.filter(d => d.depth <= 3))
    .join('text')
    .text(d => d.data.name)
    .attr('font-size', d => {
      const scale = isMobile ? 0.85 : 1
      if (d.depth === 0) return `${14 * scale}px`
      if (d.depth === 1) return `${10 * scale}px`
      if (d.depth === 2) return `${8 * scale}px`
      return `${7 * scale}px`
    })
    .attr('font-weight', d => d.depth <= 1 ? 600 : 400)
    .attr('fill', 'var(--color-text-primary)')
    .attr('text-anchor', 'middle')
    .attr('dy', d => d.radius + (isMobile ? 8 : 10))
    .style('pointer-events', 'none')
    .style('user-select', 'none')
    .style('opacity', d => d.depth === 3 ? 0.9 : 1)

  // Hover interactions
  node
    .on('mouseenter', function(event, d) {
      if (!selectedSkillDetails.value) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', d.radius * 1.5)
          .attr('opacity', 1)

        hoveredNode.value = d
        updateTooltipPosition(event)
      }
    })
    .on('mousemove', function(event) {
      if (!selectedSkillDetails.value) {
        updateTooltipPosition(event)
      }
    })
    .on('mouseleave', function(event, d) {
      if (!selectedSkillDetails.value) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', d.radius)
          .attr('opacity', 0.8)

        hoveredNode.value = null
      }
    })
    .on('click', function(event, d) {
      event.stopPropagation()

      // Debug log
      console.log('Node clicked:', d.data.name, 'skillKey:', d.data.skillKey, 'depth:', d.depth)

      // Toggle simulation pause/resume
      toggleSimulation()

      // Show skill details if it's a leaf node with skillKey
      if (d.data.skillKey) {
        console.log('Showing details for:', d.data.skillKey)
        showSkillDetails(d)
      } else {
        console.log('No skillKey, highlighting connections')
        // For non-leaf nodes, just highlight connections
        highlightConnections(d)
      }
    })

  // Click on background to resume simulation
  svg.on('click', function() {
    if (selectedSkillDetails.value) {
      closeDetails()
    }
  })

  // Update positions on simulation tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)

    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)

    label
      .attr('x', d => d.x)
      .attr('y', d => d.y)
  })
}

function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  function dragged(event, d) {
    d.fx = event.x
    d.fy = event.y
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0)
    d.fx = null
    d.fy = null
  }

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended)
}

function updateTooltipPosition(event) {
  tooltipStyle.value = {
    left: `${event.pageX + 15}px`,
    top: `${event.pageY + 15}px`
  }
}

// Show skill details panel
function showSkillDetails(node) {
  const skillKey = node.data.skillKey
  if (!skillKey) return

  // Get metadata and usage
  const metadata = skillsMetadata[skillKey] || {}
  const usage = getSkillUsage(skillKey)

  selectedSkillDetails.value = {
    name: node.data.name,
    variant: node.data.variant,
    courses: metadata.courses || [],
    wikiUrl: metadata.wikiUrl || null,
    experiences: usage.experiences || [],
    projects: usage.projects || []
  }

  // Highlight this node
  d3.selectAll('circle')
    .transition()
    .duration(200)
    .attr('opacity', d => d.id === node.id ? 1 : 0.3)
}

// Close details panel
function closeDetails() {
  selectedSkillDetails.value = null
  hoveredNode.value = null

  // Reset all nodes opacity
  d3.selectAll('circle')
    .transition()
    .duration(200)
    .attr('opacity', 0.8)

  // Resume simulation if it was paused
  if (!isSimulationRunning.value) {
    toggleSimulation()
  }
}

// Highlight connected nodes (for non-leaf nodes)
function highlightConnections(node) {
  const connectedIds = new Set()
  links.forEach(link => {
    if (link.source.id === node.id) connectedIds.add(link.target.id)
    if (link.target.id === node.id) connectedIds.add(link.source.id)
  })
  connectedIds.add(node.id)

  d3.selectAll('circle').attr('opacity', n => connectedIds.has(n.id) ? 1 : 0.2)
  d3.selectAll('line').attr('stroke-opacity', l =>
    l.source.id === node.id || l.target.id === node.id ? 0.8 : 0.1
  )

  // Reset after 2 seconds
  setTimeout(() => {
    if (!selectedSkillDetails.value) {
      d3.selectAll('circle').attr('opacity', 0.8)
      d3.selectAll('line').attr('stroke-opacity', 0.4)
    }
  }, 2000)
}

// Toggle simulation running/paused
function toggleSimulation() {
  if (isSimulationRunning.value) {
    simulation.stop()
    isSimulationRunning.value = false
  } else {
    simulation.alpha(0.3).restart()
    isSimulationRunning.value = true
  }
}

// Handle window resize
function handleResize() {
  if (!svgContainer.value) return

  // Get new container dimensions
  const containerRect = svgContainer.value.getBoundingClientRect()
  width.value = containerRect.width
  height.value = Math.max(containerRect.height, 500)

  if (svg) {
    svg.attr('viewBox', [0, 0, width.value, height.value])

    // Update forces
    simulation
      .force('center', d3.forceCenter(width.value / 2, height.value / 2))
      .force('radial', d3.forceRadial(
        d => d.depth * (width.value <= 600 ? 80 : 120),
        width.value / 2,
        height.value / 2
      ).strength(0.4))
      .alpha(0.3)
      .restart()
  }
}

onMounted(() => {
  initVisualization()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (simulation) simulation.stop()
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.skills-tree-container {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-height: 500px;
  margin: 0 auto;
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  overflow: visible;
  border: 1px solid var(--color-border);
  display: flex;
  gap: 0;
}

.visualization-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
}

.svg-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .skills-tree-container {
    max-width: 100%;
    min-height: 400px;
  }
}

@media (max-width: 480px) {
  .skills-tree-container {
    min-height: 350px;
    border-radius: var(--radius);
  }
}

.tooltip {
  position: absolute;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-lg);
  pointer-events: none;
  z-index: 1000;
  max-width: 250px;
}

.tooltip h4 {
  margin: 0 0 var(--space-2) 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.variant-badge {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius);
  font-size: 0.6875rem;
  font-weight: 500;
  background: transparent;
  border: 1px solid var(--color-border);
}

.badge-text { color: var(--color-text-task); }
.badge-vision { color: var(--color-vision-task); }
.badge-audio { color: var(--color-audio-task); }
.badge-multimodal { color: var(--color-multimodal-task); }
.badge-tabular { color: var(--color-tabular-task); }

/* Details Panel */
.details-panel {
  position: absolute;
  right: 0;
  top: 0;
  width: 320px;
  height: 100%;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow-y: auto;
  z-index: 10;
}

.details-header {
  position: sticky;
  top: 0;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 11;
}

.details-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.details-content {
  padding: var(--space-4);
}

.detail-section {
  margin-bottom: var(--space-6);
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.wiki-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text-primary);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.15s ease;
}

.wiki-link:hover {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.courses-list,
.usage-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.courses-list li {
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius);
  margin-bottom: var(--space-2);
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.usage-list li {
  padding: var(--space-3);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius);
  margin-bottom: var(--space-2);
  border-left: 3px solid var(--color-primary);
}

.usage-list li strong {
  display: block;
  color: var(--color-text-primary);
  font-size: 0.875rem;
  margin-bottom: var(--space-1);
}

.usage-list li .text-secondary {
  display: block;
  font-size: 0.8125rem;
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .skills-tree-container {
    flex-direction: column;
    overflow: hidden;
  }

  .details-panel {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 90%;
    max-width: 400px;
    height: 100vh;
  }
}

@media (max-width: 480px) {
  .details-panel {
    width: 100%;
    max-width: 100%;
  }
}
</style>
