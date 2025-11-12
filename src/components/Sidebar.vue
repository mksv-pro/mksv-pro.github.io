<template>
  <aside class="sidebar" style="border-right: 1px solid var(--color-border); padding-right: var(--space-8);">
    <!-- Avatar & Name -->
    <div class="profile-card card mb-4">
      <div class="profile-avatar" style="margin-bottom: 2rem;">
        <img src="/images/profil_pic.png">
      </div>

      <h1 class="text-center mb-2" style="font-size: 1.5rem;">Mike Silva</h1>
      <p class="text-center text-secondary mb-3" style="font-size: 0.9375rem;">
        22y(m) Student. Paris. <br></br>
        Computational Science enthusiast
      </p>

      <div class="divider" style="margin: var(--space-3) 0;"></div>

      <!-- Quick Bio -->
      <div class="mb-3">
        <p class="text-sm text-secondary" style="line-height: 1.5; margin-bottom: 0;">
        MS Math @SU · MS Physics @UPC
        <br></br>
        BS Economics & Finance @PSL
        </p>
      </div>

      <div class="divider" style="margin: var(--space-3) 0;"></div>

      <!-- Navigation -->
      <div class="mb-3">
        <h3 class="text-base font-semibold mb-3">Navigation</h3>
        <nav class="sidebar-nav">
          <router-link to="/" class="sidebar-nav-link">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="flex-shrink: 0;">
              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
            </svg>
            <span>About</span>
          </router-link>
          <router-link to="/research" class="sidebar-nav-link">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="flex-shrink: 0;">
              <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3.797a1.5 1.5 0 0 1 1.06.44l.122.12C8.12 2.202 8.633 2.5 9.203 2.5h4.297A1.5 1.5 0 0 1 15 4v1.5a.5.5 0 0 1-1 0V4a.5.5 0 0 0-.5-.5H2.5a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 1 1 0v7A1.5 1.5 0 0 1 13.5 15h-11A1.5 1.5 0 0 1 1 13.5v-11z"/>
            </svg>
            <span>Research</span>
          </router-link>
        </nav>
      </div>

      <div class="divider" style="margin: var(--space-3) 0;"></div>

      <!-- Contact Links -->
      <div class="mb-3">
        <h3 class="text-base font-semibold mb-3">Contact</h3>

        <div class="flex flex-col gap-2">
        <a href="mailto:pro.mikesilva@gmail.com" class="link flex items-center gap-2 text-sm">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="flex-shrink: 0;">
          <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.758 2.855L15 11.114v-5.73zm-.034 6.878L9.271 8.82 8 9.583 6.728 8.82l-5.694 3.44A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.739zM1 11.114l4.758-2.876L1 5.383v5.73z"/>
          </svg>

          <span style="font-size: 0.8125rem;">pro.mikesilva@gmail.com</span>
          </a>

          <a href="https://linkedin.com/in/yourname" target="_blank" class="link flex items-center gap-2 text-sm">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="flex-shrink: 0;">
              <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
            </svg>
            <span style="font-size: 0.8125rem;">LinkedIn</span>
          </a>

          <a href="https://github.com/yourname" target="_blank" class="link flex items-center gap-2 text-sm">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="flex-shrink: 0;">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            <span style="font-size: 0.8125rem;">GitHub</span>
          </a>

          <a href="https://orcid.org/0000-0000-0000-0000" target="_blank" class="link flex items-center gap-2 text-sm">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="flex-shrink: 0;">
              <path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zM5.5 11.5h-1v-7h1v7zm-.5-8c-.414 0-.75-.336-.75-.75S4.586 2 5 2s.75.336.75.75-.336.75-.75.75zm6.5 8h-1V7.75c0-1-.75-1.5-1.5-1.5s-1.5.5-1.5 1.5v3.75h-1v-7h1v.5c.25-.375.875-.75 1.5-.75 1.375 0 2.5 1.125 2.5 2.5v4.75z"/>
            </svg>
            <span style="font-size: 0.8125rem;">ORCID iD</span>
          </a>
        </div>
      </div>

      <div class="divider" style="margin: var(--space-3) 0;"></div>

      <!-- Download CV Button -->
      <a href="#" class="btn btn-secondary" style="width: 100%; justify-content: center; font-size: 0.875rem;">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
        </svg>
        Download CV
      </a>
    </div>

  </aside>
</template>

<style scoped>
.profile-avatar {
  width: 200px;
  height: 200px;
  margin: 0 auto;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

svg {
  flex-shrink: 0;
}

/* Sidebar Navigation */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sidebar-nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  text-decoration: none;
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.sidebar-nav-link:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.sidebar-nav-link.router-link-active {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}
</style>
