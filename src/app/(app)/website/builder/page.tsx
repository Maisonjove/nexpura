import { getOrCreateDefaultPages } from "./actions";
import BuilderPageListClient from "./BuilderPageListClient";

export const metadata = { title: "Website Builder — Nexpura" };

export default async function WebsiteBuilderPage() {
  const { data: pages } = await getOrCreateDefaultPages();
  return <BuilderPageListClient initialPages={pages} />;
}
