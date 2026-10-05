import './DevelopmentPlaceholder.css'

export function DevelopmentPlaceholder({ message, inDashboard = false }: { message: string; inDashboard?: boolean }) {
  return <section className={`development-placeholder${inDashboard ? ' development-placeholder--dashboard' : ''}`} aria-labelledby="development-placeholder-title">
    <div className="development-placeholder__card">
      <img className="development-placeholder__logo" src="/logo.png" alt="PsicoArte" />
      <h1 id="development-placeholder-title">{message}</h1>
    </div>
  </section>
}
