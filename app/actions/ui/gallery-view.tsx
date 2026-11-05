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
        <main
          mix={css({
            width: 'min(100% - 3rem, 72rem)',
            marginInline: 'auto',
            paddingBlock: theme.space.xxl,
            display: 'grid',
            gap: theme.space.xxl,
            flex: '1 1 auto',
            alignContent: 'start',
          })}
        >
          <header
            mix={css({
              display: 'grid',
              gap: theme.space.sm,
              maxWidth: '52rem',
            })}
          >
            <p
              mix={css({
                margin: 0,
                color: theme.colors.text.muted,
                fontSize: theme.fontSize.xs,
                fontWeight: theme.fontWeight.medium,
                letterSpacing: theme.letterSpacing.meta,
                textTransform: 'uppercase',
              })}
            >
              Entwicklung
            </p>
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
            <p mix={hintCss}>
              Statisches HTML-Fragment:{' '}
              <a
                href={routes.ui.html.href({ name: 'static-frame' })}
                data-rmx-document
                mix={css({ color: theme.colors.text.primary, textDecoration: 'underline' })}
              >
                static-frame
              </a>{' '}
              — gestreamt mit <code>openLazyFile()</code> + <code>createFileResponse()</code>.
            </p>
          </header>

          {groups.length === 0 ? (
            <p
              mix={css({
                margin: 0,
                padding: theme.space.xl,
                border: `1px dashed ${theme.colors.border.default}`,
                borderRadius: theme.radius.lg,
                color: theme.colors.text.muted,
                fontSize: theme.fontSize.sm,
              })}
            >
              Noch keine Demos gefunden.
            </p>
          ) : (
            <div
              mix={css({
                display: 'grid',
                gap: theme.space.xxl,
              })}
            >
              {groups.map((group) => (
                <section
                  key={group.title}
                  mix={css({
                    display: 'grid',
                    gap: theme.space.md,
                  })}
                >
                  <h2
                    mix={css({
                      margin: 0,
                      fontSize: theme.fontSize.lg,
                      fontWeight: theme.fontWeight.semibold,
                      lineHeight: theme.lineHeight.tight,
                      color: theme.colors.text.primary,
                    })}
                  >
                    {group.title}
                  </h2>
                  <ol
                    mix={css({
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))',
                      gap: theme.space.md,
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                    })}
                  >
                    {group.demos.map((demo) => (
                      <li
                        key={demo.filename}
                        mix={css({
                          display: 'flex',
                          minWidth: 0,
                        })}
                      >
                        <a
                          href={routes.ui.demo.href({ filename: demo.filename })}
                          mix={css({
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
                          })}
                        >
                          <span
                            mix={css({
                              fontSize: theme.fontSize.sm,
                              fontWeight: theme.fontWeight.semibold,
                              lineHeight: theme.lineHeight.tight,
                            })}
                          >
                            {demo.title}
                          </span>
                          <code
                            mix={css({
                              color: theme.colors.text.muted,
                              fontSize: theme.fontSize.xxs,
                              overflowWrap: 'anywhere',
                            })}
                          >
                            {demo.filename}
                          </code>
                          {demo.description ? (
                            <span
                              mix={css({
                                color: theme.colors.text.secondary,
                                fontSize: theme.fontSize.xs,
                                lineHeight: theme.lineHeight.normal,
                              })}
                            >
                              {demo.description}
                            </span>
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
        <main
          mix={css({
            display: 'grid',
            gap: theme.space.xl,
            width: 'min(100% - 3rem, 80rem)',
            marginInline: 'auto',
            paddingBlock: theme.space.xl,
            flex: '1 1 auto',
            alignContent: 'start',
          })}
        >
          <header
            mix={css({
              display: 'grid',
              gap: theme.space.sm,
              maxWidth: '52rem',
            })}
          >
            <a
              href={routes.ui.index.href()}
              mix={css({
                justifySelf: 'start',
                color: theme.colors.text.link,
                fontSize: theme.fontSize.sm,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              })}
            >
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
            mix={
              demo.layout === 'center'
                ? [
                    stageCss,
                    css({
                      display: 'grid',
                      placeItems: 'center',
                      minHeight: '18rem',
                    }),
                  ]
                : stageCss
            }
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

const stageCss = css({
  minWidth: 0,
  padding: theme.space.xl,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.xs,
})
