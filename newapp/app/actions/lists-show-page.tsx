import { PageSection, pageStackCss, panelCss, bodyTextCss } from '../ui/page-primitives.tsx'

export function ListsShowPage() {
  return () => (
    <div mix={pageStackCss}>
      <PageSection title="Saved List" description="Items saved to your local list.">
        <div mix={panelCss}>
          <p mix={bodyTextCss}>
            Open the main <a href="/lists">lists page</a> to add, edit, and manage your list items.
            Items are saved to your browser and persist across visits.
          </p>
        </div>
      </PageSection>
    </div>
  )
}
