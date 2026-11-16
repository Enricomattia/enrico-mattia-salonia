import { redirect } from "next/navigation";
export const metadata={title:"Pathos",robots:{index:false,follow:false}};
export default function PathosPersonalRoute(){redirect("/pathos-personal/index.html");}
