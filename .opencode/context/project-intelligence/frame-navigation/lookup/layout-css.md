<!-- Context: frame-navigation/lookup/layout-css | Priority: medium | Version: 1.0 | Updated: 2026-03-25 -->

# Layout CSS Classes Reference

**Purpose**: Quick reference for layout CSS classes in `public/admin.css`.

---

## Main App Layout (`.main-*`)

```css
.main-app-body      /* Page body */
.main-app-shell    /* Grid: 280px sidebar + main */
.main-sidebar      /* Sticky sidebar */
.main-sidebar-header
.main-brand-link   /* "Atlas LMS" */
.main-sidebar-subtitle  /* "Student workspace" */
.main-nav          /* Navigation links */
.main-logout-button
.main-content      /* Main content area */
.main-header
.main-title
```

---

## Settings Layout (`.settings-*`)

```css
.settings-content-shell     /* Grid: sidebar + content */
.settings-secondary-sidebar
.settings-secondary-sidebar-title
.settings-secondary-nav
.settings-content
```

---

## Page Styles (`.page-*`)

```css
.page
.page-header
.page-title
.back-link
```

---

## Card Components

```css
.stat-card          /* Dashboard stat card */
.stat-label
.stat-value
.course-item        /* Course list item */
.course-header
.course-title
.course-description
.course-meta
.calendar-card
.calendar-event
```

---

## Settings Pages

```css
.settings-title
.settings-description
.settings-card      /* Generic settings card */
.settings-card-wide
.settings-setting   /* Setting row: label + value */
.settings-details   /* Definition list (dl) */
.settings-term      /* dt */
.settings-value     /* dd */
.settings-list
.settings-list-item
```

---

## CSS Variables for Colors

```css
/* Backgrounds */
--bg-primary: #ffffff --bg-secondary: #f8fafc --bg-tertiary: #f1f5f9 /* Text */ --text-primary:
  #0f172a --text-secondary: #475569 --text-muted: #64748b /* Borders */ --border-default: #e2e8f0
  --border-hover: #cbd5e1 /* Dark mode: [data-theme='dark'] */;
```

---

## Dark Mode Pattern

```css
[data-theme='dark'] .main-sidebar {
  background-color: var(--bg-primary);
  border-color: var(--border-default);
}
```
