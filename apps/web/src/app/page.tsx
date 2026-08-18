import { ExampleForm } from '@/components/examples/example-form';

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Bienvenue sur DONDY ELEVAGE</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Fondations techniques posées (Phase 0). Les modules métier — élevage, stocks, ventes,
          finances, patrimoine — seront ajoutés progressivement à partir de la Phase 3.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">
          Exemple de formulaire (React Hook Form + Zod)
        </h2>
        <ExampleForm />
      </section>
    </div>
  );
}
