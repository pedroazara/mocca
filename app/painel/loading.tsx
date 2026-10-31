// Aparece na hora ao trocar de página, enquanto o servidor busca os dados.
export default function Carregando() {
  return (
    <div role="status" aria-label="Carregando" className="animate-pulse space-y-4 p-6 motion-reduce:animate-none">
      <div className="h-8 w-48 rounded-m bg-superficie-2" />
      <div className="h-32 rounded-g bg-superficie-2" />
      <div className="h-56 rounded-g bg-superficie-2" />
    </div>
  );
}
