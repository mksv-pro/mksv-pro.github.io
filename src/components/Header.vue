<template>
  <header class="header">
    <div class="container">
      <div class="header-content">
        <!-- Navigation -->
        <nav class="nav">
          <router-link to="/" class="nav-link">
            About
          </router-link>
          <router-link to="/research" class="nav-link">
            Research
          </router-link>
        </nav>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) 0;
  gap: var(--space-6);
}

/* Logo */
.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-decoration: none;
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 1rem;
  transition: opacity 0.15s ease;
}

.logo:hover {
  opacity: 0.7;
}

.logo-text {
  white-space: nowrap;
}

/* Navigation */
.nav {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  flex: 1;
  justify-content: center;
}

.nav-link {
  text-decoration: none;
  color: var(--color-text-secondary);
  font-weight: 500;
  font-size: 0.9375rem;
  transition: color 0.15s ease;
  padding: var(--space-2) var(--space-1);
  position: relative;
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--color-text-primary);
}

.nav-link.router-link-active {
  color: var(--color-text-primary);
}

.nav-link.router-link-active::after {
  content: '';
  position: absolute;
  bottom: -var(--space-4);
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    padding: var(--space-3) 0;
    gap: var(--space-4);
  }

  .nav {
    gap: var(--space-4);
    flex: 1;
    justify-content: flex-end;
  }

  .nav-link {
    font-size: 0.875rem;
    padding: var(--space-1);
  }
}

@media (max-width: 640px) {
  .logo-text {
    display: none;
  }

  .nav {
    gap: var(--space-3);
  }
}
</style>
