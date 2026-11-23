import { redirect } from "next/navigation";

export const metadata = {
  title: "Saggezza",
  robots: { index: false, follow: false },
};

export default function PapaPage() {
  redirect("/papa/index.html");
}
