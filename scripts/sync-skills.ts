import { syncSkillFarm, syncVendorSkill } from './skills-sync-lib.ts'

async function main() {
  let links = await syncVendorSkill()
  let { created, removed } = await syncSkillFarm()

  console.log(`Linked remix vendor skill: ${links.join(' → ')}`)
  if (created.length > 0) {
    console.log(`Linked skills into .agents/skills: ${created.join(', ')}`)
  }
  if (removed.length > 0) {
    console.log(`Removed stale skill links: ${removed.join(', ')}`)
  }
}

main().catch(console.error)
