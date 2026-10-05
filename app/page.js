import { redirect } from 'next/navigation'

// Nu există site public: pagina principală este ecranul de autentificare.
export default function Home() {
  redirect('/login')
}
