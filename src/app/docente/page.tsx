import { redirect } from "next/navigation";

export default function DocenteIndex() {
    // Si alguien entra a /docente, lo mandamos a la pantalla correcta
    redirect("/estudiantes");
}
