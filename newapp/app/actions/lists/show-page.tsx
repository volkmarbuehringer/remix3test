import { PageSection, pageStackCss, panelCss, bodyTextCss } from '../../ui/page-primitives.tsx'

export function ListsShowPage() {
  return () => (
    <div mix={pageStackCss}>
      <PageSection title="Gespeicherte Liste" description="In deiner lokalen Liste gespeicherte Elemente.">
        <div mix={panelCss}>
          <p mix={bodyTextCss}>
            Öffne die <a href="/lists">Listen-Seite</a>, um Elemente hinzuzufügen, zu bearbeiten und zu verwalten.
            Elemente werden im Browser gespeichert und bleiben über Besuche hinweg erhalten.
          </p>
        </div>
      </PageSection>
    </div>
  )
}
