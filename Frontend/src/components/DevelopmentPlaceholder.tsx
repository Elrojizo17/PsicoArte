import '../pages/PerfilPadre.css'

export function DevelopmentPlaceholder({ message }: { message: string }) {
  return <main className="parent-profile-page">
    <section className="parent-profile-card" aria-label={message}>
      <img className="parent-profile-logo" src="/src/assets/logo.png" alt="PsicoArte" />
      <h1>{message}</h1>
    </section>
  </main>
}
