import { createFileRoute } from "@tanstack/react-router";
import {
  LegalDocumentPage,
  legalDocumentHead,
  loadPublishedLegalPage,
} from "@/components/legal/LegalDocumentPage";
import { RouteErrorState } from "@/components/layout/RouteErrorState";

/**
 * «Как пользоваться» — обзор площадки с записью экрана.
 *
 * Содержимое правится из админки тем же механизмом, что правовые
 * страницы: черновик и публикация, версии с возвратом, разметка с
 * предпросмотром. В коде — только адрес и оболочка.
 *
 * Рядом живёт «Как работает платформа» (`/how-it-works`): та про
 * доступ к функциям, эта про то, как всё устроено на экране. Разные
 * страницы, и сводить их — решение заказчика, а не выкатки.
 */
export const Route = createFileRoute("/how-to-use")({
  errorComponent: RouteErrorState,
  loader: () => loadPublishedLegalPage("how-to-use"),
  head: ({ loaderData }) => legalDocumentHead(loaderData, "pages.info.metaTitle"),
  component: HowToUsePage,
});

function HowToUsePage() {
  return <LegalDocumentPage page={Route.useLoaderData()} />;
}
