import { getOrCreateDefaultPages } from "./actions";
import BuilderPageListClient from "./BuilderPageListClient";

export default async function WebsiteBuilderPage() {
  const { data: pages } = await getOrCreateDefaultPages();
  return <BuilderPageListClient initialPages={pages} />;
}
