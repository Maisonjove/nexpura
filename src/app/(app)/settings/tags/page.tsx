import { getTagTemplates, deleteTagTemplate, setDefaultTemplate } from "./actions"
import TagTemplateManager from "./TagTemplateManager"

export const dynamic = "force-dynamic"

export default async function StockTagsSettingsPage() {
  const templates = await getTagTemplates()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-fraunces text-2xl font-semibold text-forest">Stock Tag Templates</h1>
        <p className="text-sm text-forest/50 mt-1">Design and manage your stock tag templates for printing price labels.</p>
      </div>
      <TagTemplateManager templates={templates} />
    </div>
  )
}
