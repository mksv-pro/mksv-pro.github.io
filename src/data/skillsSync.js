// Automatic synchronization between skills and projects/experiences
import { experiences, projects } from './content.js'

/**
 * Find all projects and experiences that use a specific skill
 * @param {string} skillKey - The key of the skill (e.g., 'python', 'pytorch')
 * @returns {Object} - Object containing related experiences and projects
 */
export function getSkillUsage(skillKey) {
  const relatedExperiences = []
  const relatedProjects = []

  // Search in experiences
  experiences.forEach(exp => {
    if (exp.skills && exp.skills.some(skill => skill.skillKey === skillKey || skill.name?.toLowerCase() === skillKey.toLowerCase())) {
      relatedExperiences.push({
        id: exp.id,
        title: exp.title,
        institution: exp.institution,
        period: exp.period
      })
    }
  })

  // Search in projects
  projects.forEach(proj => {
    if (proj.technologies && proj.technologies.some(tech => tech.skillKey === skillKey || tech.name?.toLowerCase() === skillKey.toLowerCase())) {
      relatedProjects.push({
        id: proj.id,
        title: proj.title,
        description: proj.description
      })
    }
  })

  return {
    experiences: relatedExperiences,
    projects: relatedProjects,
    totalUsage: relatedExperiences.length + relatedProjects.length
  }
}

/**
 * Enrich a skill node with usage information from projects and experiences
 * @param {Object} skillNode - D3 hierarchy node containing skill data
 * @param {string} skillKey - The key to look up the skill
 * @returns {Object} - Enriched skill data
 */
export function enrichSkillWithUsage(skillNode, skillKey) {
  if (!skillKey || !skillNode) return skillNode

  const usage = getSkillUsage(skillKey)

  return {
    ...skillNode,
    usage: usage,
    hasUsage: usage.totalUsage > 0
  }
}

/**
 * Get all skills used across the portfolio with usage statistics
 * @returns {Array} - Array of skills with usage counts
 */
export function getAllSkillsWithUsage() {
  const skillsMap = new Map()

  // Collect from experiences
  experiences.forEach(exp => {
    if (exp.skills) {
      exp.skills.forEach(skill => {
        const key = skill.skillKey || skill.name
        if (!skillsMap.has(key)) {
          skillsMap.set(key, {
            name: skill.name,
            experiences: [],
            projects: []
          })
        }
        skillsMap.get(key).experiences.push({
          id: exp.id,
          title: exp.title
        })
      })
    }
  })

  // Collect from projects
  projects.forEach(proj => {
    if (proj.technologies) {
      proj.technologies.forEach(tech => {
        const key = tech.skillKey || tech.name
        if (!skillsMap.has(key)) {
          skillsMap.set(key, {
            name: tech.name,
            experiences: [],
            projects: []
          })
        }
        skillsMap.get(key).projects.push({
          id: proj.id,
          title: proj.title
        })
      })
    }
  })

  // Convert to array and add usage count
  return Array.from(skillsMap.entries()).map(([key, data]) => ({
    skillKey: key,
    name: data.name,
    experiences: data.experiences,
    projects: data.projects,
    totalUsage: data.experiences.length + data.projects.length
  })).sort((a, b) => b.totalUsage - a.totalUsage)
}
