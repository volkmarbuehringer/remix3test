import type { EntryComponent, Handle } from 'remix/component'
import { css } from 'remix/component'

import { routes } from '../../routes.ts'
import { Document } from '../../ui/document.tsx'
import { theme } from '../../ui/theme/theme.ts'
import type { DemoFile } from './discovery.ts'

interface GalleryIndexPageProps {
  demos: DemoFile[]
}

export function GalleryIndexPage(handle: Handle<GalleryIndexPageProps>) {
  return () => {
    let groups = groupDemos(handle.props.demos)

    return (
      <Document title="UI-Galerie" description="Server-gerenderte Komponenten-Demos aus app/ui.">
        <main mix={pageCss}>
          <header mix={headerCss}>
            <p mix={eyebrowCss}>Entwicklung</p>
            <h1 mix={titleCss}>UI-Galerie</h1>
            <p mix={leadCss}>
              {handle.props.demos.length} server-gerenderte Komponenten-Demos. Jede Datei unter{' '}
              <code>app/ui</code> mit der Endung <code>.demo.tsx</code> (oder <code>.demo.ts</code>)
              erscheint hier automatisch.
            </p>
            <p mix={hintCss}>
              Neue Demo anlegen: <code>app/ui/…/name.demo.tsx</code> mit einem Default-Export, der
              eine Komponente zurückgibt. Die Galerie ist nur in Entwicklung und Tests erreichbar.
            </p>
          </header>

          {groups.length === 0 ? (
            <p mix={emptyCss}>Noch keine Demos gefunden.</p>
          ) : (
            <div mix={groupsCss}>
              {groups.map((group) => (
                <section key={group.title} mix={groupCss}>
                  <h2 mix={groupTitleCss}>{group.title}</h2>
                  <ol mix={listCss}>
                    {group.demos.map((demo) => (
                      <li key={demo.filename} mix={itemCss}>
                        <a
                          href={routes.ui.demo.href({ filename: demo.filename })}
                          mix={itemLinkCss}
                        >
                          <span mix={itemTitleCss}>{demo.title}</span>
                          <code mix={itemPathCss}>{demo.filename}</code>
                          {demo.description ? (
                            <span mix={itemDescriptionCss}>{demo.description}</span>
                          ) : null}
                        </a>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </main>
      </Document>
    )
  }
}

interface GalleryDemoPageProps {
  DemoComponent: EntryComponent
  demo: DemoFile
}

export function GalleryDemoPage(handle: Handle<GalleryDemoPageProps>) {
  return () => {
    let { DemoComponent, demo } = handle.props

    return (
      <Document title={`${demo.title} – UI-Galerie`} description={demo.description}>
        <main mix={demoPageCss}>
          <header mix={demoHeaderCss}>
            <a href={routes.ui.index.href()} mix={backLinkCss}>
              ← Alle Demos
            </a>
            <h1 mix={titleCss}>{demo.title}</h1>
            {demo.description ? <p mix={leadCss}>{demo.description}</p> : null}
            <p mix={hintCss}>
              Quelle: <code>{demo.filename}</code>
            </p>
          </header>

          <div
            data-gallery-demo="true"
            mix={demo.layout === 'center' ? [stageCss, centerStageCss] : stageCss}
          >
            <DemoComponent />
          </div>
        </main>
      </Document>
    )
  }
}

function groupDemos(demos: DemoFile[]): Array<{ demos: DemoFile[]; title: string }> {
  let groups = new Map<string, DemoFile[]>()

  for (let demo of demos) {
    let group = groups.get(demo.group)
    if (group) {
      group.push(demo)
    } else {
      groups.set(demo.group, [demo])
    }
  }

  return [...groups].map(([title, items]) => ({ demos: items, title }))
}

const pageCss = css({
  width: 'min(100% - 3rem, 72rem)',
  marginInline: 'auto',
  paddingBlock: theme.space.xxl,
  display: 'grid',
  gap: theme.space.xxl,
  flex: '1 1 auto',
  alignContent: 'start',
})

const headerCss = css({
  display: 'grid',
  gap: theme.space.sm,
  maxWidth: '52rem',
})

const eyebrowCss = css({
  margin: 0,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.medium,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
})

const titleCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxl,
  fontWeight: theme.fontWeight.semibold,
  lineHeight: theme.lineHeight.tight,
  color: theme.colors.text.primary,
})

const leadCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

const hintCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.muted,
})

const emptyCss = css({
  margin: 0,
  padding: theme.space.xl,
  border: `1px dashed ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.sm,
})

const groupsCss = css({
  display: 'grid',
  gap: theme.space.xxl,
})

const groupCss = css({
  display: 'grid',
  gap: theme.space.md,
})

const groupTitleCss = css({
  margin: 0,
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  lineHeight: theme.lineHeight.tight,
  color: theme.colors.text.primary,
})

const listCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))',
  gap: theme.space.md,
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

const itemCss = css({
  display: 'flex',
  minWidth: 0,
})

const itemLinkCss = css({
  display: 'grid',
  gap: theme.space.xs,
  width: '100%',
  minWidth: 0,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.xs,
  color: theme.colors.text.primary,
  textDecoration: 'none',
  '&:hover': {
    borderColor: theme.colors.border.strong,
    boxShadow: theme.shadow.sm,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
})

const itemTitleCss = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  lineHeight: theme.lineHeight.tight,
})

const itemPathCss = css({
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xxs,
  overflowWrap: 'anywhere',
})

const itemDescriptionCss = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
})

const demoPageCss = css({
  display: 'grid',
  gap: theme.space.xl,
  width: 'min(100% - 3rem, 80rem)',
  marginInline: 'auto',
  paddingBlock: theme.space.xl,
  flex: '1 1 auto',
  alignContent: 'start',
})

const demoHeaderCss = css({
  display: 'grid',
  gap: theme.space.sm,
  maxWidth: '52rem',
})

const backLinkCss = css({
  justifySelf: 'start',
  color: theme.colors.text.link,
  fontSize: theme.fontSize.sm,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
})

const stageCss = css({
  minWidth: 0,
  padding: theme.space.xl,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.xs,
})

const centerStageCss = css({
  display: 'grid',
  placeItems: 'center',
  minHeight: '18rem',
})
