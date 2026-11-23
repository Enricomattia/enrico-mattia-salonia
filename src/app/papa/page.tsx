import { redirect } from "next/navigation";

export const metadata = {
  title: "Buongiorno Papà",
  robots: { index: false, follow: false },
};

export default function PapaPage() {
  redirect("/papa/index.html");
}
